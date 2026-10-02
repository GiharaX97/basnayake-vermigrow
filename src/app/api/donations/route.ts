import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { fundTotal } from '@/lib/fund'
import { clientIp, createThrottle } from '@/lib/throttle'
import { optionalPhone, queueMessage, linkExpiry, autoDeliver } from '@/lib/notify'
import { z } from 'zod'

// How many recent donor names the wall needs.
const DONOR_LIMIT = 60

// Max 5 name submissions per IP per 30 minutes.
const donorThrottle = createThrottle({ windowMs: 30 * 60 * 1000, max: 5 })

const donorSchema = z.object({
  name: z
    .string()
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, 'Name is too short').max(60, 'Name is too long')),
  // Optional, and it goes NO FURTHER than the queued thank-you message. The
  // Donor table deliberately has no phone column and this endpoint's GET selects
  // only {id, name, amount, createdAt}, because every visitor to the wall fetches
  // it — a phone number there would be a public PII dump. If you are tempted to
  // store this, re-read the Donor model comment and DON'T.
  phone: optionalPhone,
})

export async function GET() {
  // The total is one query over the donation ledger (see src/lib/fund.ts).
  //
  // It used to be a per-channel sum here — Sale unfiltered, plus Pack where
  // status='sold'. That shape had two problems: the Sale sum counted orders that
  // had not been paid, and every new channel (gifts with no purchase, and later
  // reverse vending machines) would have needed another term in this file.
  // The ledger holds one row per contribution whatever produced it, so this
  // endpoint no longer knows or cares how many channels exist.
  const [total, donorCount, donors] = await Promise.all([
    fundTotal(prisma),
    prisma.donor.count(),
    prisma.donor.findMany({
      orderBy: { createdAt: 'desc' },
      take: DONOR_LIMIT,
      select: { id: true, name: true, amount: true, createdAt: true },
    }),
  ])

  return NextResponse.json({ total, donorCount, donors })
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (donorThrottle.check(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = donorSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Wall attribution: a scan leaves a short-lived claim cookie naming the pack.
  // The first name submitted against a pack claims its donationAmount — decided
  // entirely server-side, so the client can never post a made-up figure.
  // Name-only entries (no/used-up claim) land with amount 0.
  const cookieStore = await cookies()
  const claimedCode = cookieStore.get('vg_scan_claim')?.value

  // Read the claimed pack up front so the thank-you queued inside the claim
  // transaction knows what it is about. Read-only, so it does not need to be
  // inside the transaction; the authoritative "is it still unclaimed?" check is
  // still the `!donorId` test on the write path below.
  const claimedPack = claimedCode
    ? await prisma.pack.findUnique({
        where: { code: claimedCode },
        select: { id: true, donationAmount: true, donorId: true },
      })
    : null

  let donor
  try {
    donor = await prisma.$transaction(async (tx) => {
      if (claimedPack && !claimedPack.donorId) {
        const created = await tx.donor.create({
          data: { name: result.data.name, amount: claimedPack.donationAmount, packId: claimedPack.id },
        })
        await tx.pack.update({ where: { id: claimedPack.id }, data: { donorId: created.id } })
        // Queue the thank-you in the same transaction as the claim, so a name
        // can never be on the wall with a message to a pack that was not claimed.
        // The send happens after the commit, below — see the note there.
        await queueMessage(tx, {
          refType: 'pack',
          refId: claimedPack.id,
          template: 'scan_thanks',
          data: { name: result.data.name, amount: claimedPack.donationAmount },
          toName: result.data.name,
          toPhone: result.data.phone,
          expiresAt: linkExpiry(),
        })
        return created
      }
      return tx.donor.create({ data: { name: result.data.name } })
    })
  } catch {
    // Concurrent claim on the same pack: Donor.packId @unique rejects the loser.
    donor = await prisma.donor.create({ data: { name: result.data.name } })
  }
  // Claim is spent either way — drop it so a later name doesn't reuse the pack.
  cookieStore.delete('vg_scan_claim')

  // The thank-you goes out automatically — from a PUBLIC route, which the rest of
  // this codebase goes out of its way to avoid. Two facts make it defensible
  // rather than reckless:
  //
  // 1. A message is only ever queued when a REAL pack code was claimed, and a
  //    code claims once (Donor.packId @unique). Codes are 32^6 ≈ 1e9 and live on
  //    physical packs, so an attacker cannot mint the precondition — the volume
  //    of sendable messages is bounded by packs actually sold. The cookie is
  //    client-controlled, but setting it to a code that does not exist claims
  //    nothing and queues nothing.
  // 2. autoDeliver's daily cap bounds the whole system regardless, and anything
  //    past it stays queued for a human. The throttle above keys on a spoofable
  //    x-forwarded-for, so it is NOT what protects this path.
  //
  // Only when THIS request is the one that claimed the pack: a losing race fell
  // into the catch above, and the winner fires its own send.
  const claimedPackId = claimedPack && donor.packId === claimedPack.id ? claimedPack.id : null
  if (claimedPackId) await autoDeliver(prisma, 'pack', claimedPackId)

  return NextResponse.json(donor, { status: 201 })
}

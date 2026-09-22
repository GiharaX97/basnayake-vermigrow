import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { recordFundEntry } from '@/lib/fund'
import { clientIp, createThrottle } from '@/lib/throttle'
import { z } from 'zod'

// Pack codes printed on packs: VG-XXXXXX (unambiguous alphabet).
const CODE_REGEX = /^VG-[A-HJ-NP-Z2-9]{6}$/

// Scans are one per pack purchase, so anything above 30/min from one IP is
// abuse (scripted re-scans), not humans.
const scanThrottle = createThrottle({ windowMs: 60 * 1000, max: 30 })

const scanSchema = z.object({
  code: z.string().transform((v) => v.trim().toUpperCase()).pipe(z.string().regex(CODE_REGEX, 'Unrecognised code format')),
})

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (scanThrottle.check(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = scanSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ status: 'unknown' }, { status: 404 })
  }

  const pack = await prisma.pack.findUnique({
    where: { code: result.data.code },
    include: { product: { select: { name: true, kind: true } } },
  })
  if (!pack) {
    return NextResponse.json({ status: 'unknown' }, { status: 404 })
  }

  // One endpoint serves both kinds of sellable unit, branching on the product's
  // kind rather than on a different URL, so codes printed before services
  // existed keep resolving here.
  //   product pack  -> 'sold'     (first scan). This IS the sale.
  //   service voucher -> 'redeemed' (first scan). This is DELIVERY, not money:
  //     the seat was already paid for, and its donation was booked by the Sale
  //     then. Hence no ledger write below for services.
  const isService = pack.product.kind === 'service'
  const terminal = isService ? 'redeemed' : 'sold'
  const already = pack.status === terminal

  await prisma.$transaction(async (tx) => {
    // Log every scan; only the first is terminal. Repeat scans are kept for
    // anomaly detection (re-used codes) and never change money.
    await tx.scanEvent.create({
      data: {
        packId: pack.id,
        userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? null,
      },
    })
    await tx.pack.update({
      where: { id: pack.id },
      data: {
        scanCount: { increment: 1 },
        ...(already
          ? {}
          : isService
            ? { status: terminal, redeemedAt: new Date(), deliveredAt: new Date() }
            : { status: terminal, soldAt: new Date() }),
      },
    })

    // The contribution ledger entry for a scanned product pack. This is the
    // write that makes the wall total move; without it, scanning would stop
    // counting. `recordFundEntry` is idempotent, so a re-scan of a pack sold
    // before the ledger existed still cannot double-count.
    //
    // Services are EXCLUDED on purpose — their Sale already recorded the
    // donation. Letting a voucher write here would count one seat twice.
    if (!isService) {
      await recordFundEntry(tx, {
        channel: 'pack',
        refId: pack.id,
        amount: pack.donationAmount,
      })
    }
  })

  // Hand the buyer a short-lived claim cookie so the name they add to the wall
  // can be attributed to this pack server-side (never client-supplied amounts).
  // Works for repeat scans too — the claim is only consumed once, by the first
  // name submitted for this pack.
  //
  // Only for product packs: a voucher holder is a paying customer, not a donor,
  // and their pack carries a LKR 0 contribution, so a wall entry would be a
  // meaningless "LKR 0" row.
  const cookieStore = await cookies()
  if (!isService) {
    cookieStore.set('vg_scan_claim', pack.code, {
      httpOnly: true,
      secure: (process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })
  }

  return NextResponse.json({
    status: already ? (isService ? 'already_redeemed' : 'already') : terminal,
    kind: isService ? 'service' : 'product',
    product: pack.product.name,
    donation: isService ? 0 : pack.donationAmount,
  })
}

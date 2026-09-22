import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { recordFundEntry } from '@/lib/fund'
import { paymentMethodSchema, optionalText } from '@/lib/payments'
import { optionalPhone, queueMessage, linkExpiry } from '@/lib/notify'
import { z } from 'zod'

/**
 * Gifts with no purchase — the third money channel, alongside store sales and
 * online orders. `Sale` cannot hold these: its `productId` is required with an
 * `onDelete: Restrict` FK, so a donation-only customer has no product to point
 * at.
 */

const donationSchema = z.object({
  amount: z.coerce.number().positive('Must be more than 0').max(10_000_000),
  method: paymentMethodSchema.default('cash'),
  donorName: optionalText(120),
  // Optional, and it exists for exactly one reason: so the giver can be thanked.
  // Nullable column, so `db push` emits a plain ALTER TABLE ADD COLUMN.
  donorPhone: optionalPhone,
  note: optionalText(500),
  receivedBy: optionalText(120),
})

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [donations, agg] = await Promise.all([
    prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        payments: { select: { method: true, reference: true, receivedBy: true } },
      },
    }),
    prisma.donation.aggregate({
      where: { status: 'paid' },
      _sum: { amount: true },
      _count: true,
    }),
  ])
  return NextResponse.json({
    donations,
    totalDonated: agg._sum.amount ?? 0,
    donationCount: agg._count,
  })
}

/**
 * Record a gift the farm has already received.
 *
 * Created as 'paid' rather than 'pending': an admin only reaches this form
 * holding the cash or having seen the transfer clear, so a pending state would
 * be a half-state nobody could resolve. `Donation.status` keeps 'pending' and
 * 'cancelled' in its vocabulary for a future pledge workflow.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = donationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { amount, method, donorName, donorPhone, note, receivedBy } = parsed.data

  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: { amount, method, donorName, donorPhone, note, status: 'paid' },
    })
    // Same-transaction ledger write: a recorded gift can never exist without
    // its contribution counted, or the reverse.
    await recordFundEntry(tx, { channel: 'direct', refId: created.id, amount })
    await tx.payment.create({
      data: { amount, method, receivedBy, note, donationId: created.id },
    })
    // And the thank-you, queued in the same transaction for the same reason. A
    // giver with no number on file simply gets no row — see the queue rule in
    // src/lib/notify.ts.
    await queueMessage(tx, {
      refType: 'donation',
      refId: created.id,
      template: 'gift_thanks',
      data: { name: donorName, amount },
      toName: donorName,
      toPhone: donorPhone,
      expiresAt: linkExpiry(),
    })
    return created
  })

  return NextResponse.json(donation, { status: 201 })
}

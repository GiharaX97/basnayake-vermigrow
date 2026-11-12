import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cancelFundEntry, recordFundEntry } from '@/lib/fund'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { optionalText, paymentMethodSchema, OrderStateError } from '@/lib/payments'
import { autoDeliver, linkExpiry, queueMessage } from '@/lib/notify'
import { z } from 'zod'

/**
 * Reverse a recorded gift.
 *
 * The row is marked 'cancelled', never deleted: the same rule as deleting a
 * single sale. The public total must drop, because the money is no longer
 * expected — but the record that it was once counted has to survive, or the
 * fund's history stops being auditable.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  try {
    await prisma.$transaction(async (tx) => {
      await tx.donation.update({ where: { id }, data: { status: 'cancelled' } })
      await cancelFundEntry(tx, 'direct', id)
      // The wall entry goes with the money. A cancelled gift's name must not
      // keep sitting beside a total it no longer contributes to.
      await tx.donor.deleteMany({ where: { source: 'direct', sourceRef: id } })
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
  }
}

const receiveSchema = z.object({
  action: z.literal('receive'),
  method: paymentMethodSchema.default('other'),
  receivedBy: optionalText(120),
  note: optionalText(500),
})

/**
 * Confirm a donation-only pledge placed from the public site.
 *
 * A public gift is created 'pending' and counted by NOTHING until this runs:
 * no FundEntry, no Payment, no wall entry, no SMS. That is deliberate — the
 * site cannot take card money today, so a pledge is a promise, and only the
 * admin who saw the cash or the transfer may turn it into money.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = receiveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const donation = await prisma.donation.findUnique({ where: { id } })
  if (!donation) return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
  if (donation.status !== 'pending') {
    return NextResponse.json(
      { error: 'This gift has already been counted or cancelled.' },
      { status: 409 }
    )
  }

  const { method, receivedBy, note } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      // Claim first: two admins confirming at once must produce one receipt.
      const claimed = await tx.donation.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'paid', method },
      })
      if (claimed.count === 0) {
        throw new OrderStateError('This gift has already been counted.')
      }

      await recordFundEntry(tx, { channel: 'direct', refId: id, amount: donation.amount })
      await tx.payment.create({
        data: {
          amount: donation.amount,
          method,
          receivedBy: receivedBy ?? null,
          note: note ?? donation.note ?? null,
          donationId: id,
        },
      })
      if (donation.donorName) {
        const existing = await tx.donor.findFirst({
          where: { source: 'direct', sourceRef: id },
          select: { id: true },
        })
        if (!existing) {
          await tx.donor.create({
            data: {
              name: donation.donorName,
              amount: donation.amount,
              source: 'direct',
              sourceRef: id,
            },
          })
        }
      }
      await queueMessage(tx, {
        refType: 'donation',
        refId: id,
        template: 'gift_thanks',
        data: { name: donation.donorName, amount: donation.amount },
        toName: donation.donorName,
        toPhone: donation.donorPhone,
        expiresAt: linkExpiry(),
      })
    })
  } catch (err) {
    if (err instanceof OrderStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not confirm this gift' }, { status: 500 })
  }

  await autoDeliver(prisma, 'donation', id)
  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { settleSchema, OrderStateError } from '@/lib/payments'
import { queueMessage, autoDeliver } from '@/lib/notify'
import { cancelOrderTx, settleOrderTx } from '@/lib/order-actions'

/**
 * Settle a customer order: either take the money ('pay') or call it off
 * ('cancel'). Moves every line of the order together — an order is one thing to
 * the customer, so a half-settled order is not a state worth supporting.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderRef: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { orderRef } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = settleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.action === 'pay') {
      const { method, reference, receivedBy, note } = parsed.data

      const result = await prisma.$transaction(async (tx) => {
        // The status flip, vouchers, ledger row, receipt, timeline entry and the
        // customer's message all live in settleOrderTx — shared with the
        // Payments.lk webhook, so a card payment and a manual one cannot drift
        // apart. See src/lib/order-actions.ts.
        return settleOrderTx(tx, {
          orderRef,
          method,
          reference,
          receivedBy,
          note,
          actor: 'admin',
        })
      })

      // After the commit — the gateway must not hold the order's write lock, and
      // a gateway failure must not undo a settlement. This drains the record's
      // queue oldest-first, so an order placed online (whose reference is only in
      // order_placed) still tells a coherent story. See autoDeliver.
      await autoDeliver(prisma, 'order', orderRef)

      return NextResponse.json({ success: true, action: 'pay', orderRef, ...result })
    }

    const result = await prisma.$transaction(async (tx) => {
      // The status flips, the ledger rows and the OrderEvent all live in
      // cancelOrderTx — shared with the SMS webhook so a reply-driven cancel and
      // an admin cancel cannot drift apart. Any Payment already recorded is
      // deliberately LEFT ALONE: if money did arrive, cancelling is a refund
      // question, not a reason to erase the record that it was received.
      const cancelled = await cancelOrderTx(tx, {
        orderRef,
        actor: 'admin',
        note: parsed.data.note,
      })

      // A customer who was told "paid — your passes are ready" and then has the
      // order cancelled must be told that too, or the receipt they hold keeps
      // saying money was received. Only sent if a phone is on file; for an order
      // placed online there always is one.
      await queueMessage(tx, {
        refType: 'order',
        refId: orderRef,
        template: 'order_cancelled',
        data: { name: cancelled.customerName, orderRef },
        toName: cancelled.customerName,
        toPhone: cancelled.customerPhone,
      })

      return { lines: cancelled.lines, donationRemoved: cancelled.donationRemoved }
    })

    // A cancellation is news the customer must have, for the same reason the
    // message was queued at all: the receipt they hold still says money was
    // received until they are told otherwise.
    await autoDeliver(prisma, 'order', orderRef)

    return NextResponse.json({ success: true, action: 'cancel', orderRef, ...result })
  } catch (err) {
    if (err instanceof OrderStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not settle this order' }, { status: 500 })
  }
}

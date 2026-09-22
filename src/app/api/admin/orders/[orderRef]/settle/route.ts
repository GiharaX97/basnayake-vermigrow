import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { recordFundEntry, cancelFundEntry } from '@/lib/fund'
import { settleSchema, OrderStateError } from '@/lib/payments'
import { generatePackCodes } from '@/lib/pack-codes'
import { queueMessage } from '@/lib/notify'

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
        const lines = await tx.sale.findMany({
          where: { orderRef, status: 'pending' },
          include: { product: { select: { kind: true } } },
        })
        if (lines.length === 0) {
          throw new OrderStateError(
            'This order has no unpaid lines left — it was already settled or cancelled.'
          )
        }

        const now = new Date()
        let orderTotal = 0
        let donationTotal = 0
        let vouchers = 0

        for (const line of lines) {
          await tx.sale.update({
            where: { id: line.id },
            data: { status: 'paid', paidAt: now, paymentMethod: method },
          })

          // One voucher per seat, issued at payment — this is the QR the
          // customer shows at the workshop. Minted here rather than at booking
          // so an unpaid order never produces scannable codes.
          if (line.product.kind === 'service') {
            for (const code of generatePackCodes(line.quantity)) {
              await tx.pack.create({
                data: {
                  code,
                  productId: line.productId,
                  // ZERO ON PURPOSE. The donation for a booked seat is carried
                  // by the Sale line above; a non-zero amount here would count
                  // the same seat twice into the public fund. Vouchers also
                  // never reach status='sold' (they go issued -> redeemed), so
                  // there are two independent reasons they cannot double-count.
                  // See the Pack model comment — do not "fix" this.
                  donationAmount: 0,
                  status: 'issued',
                  saleId: line.id,
                  orderRef,
                  holderName: line.customerName,
                  holderPhone: line.customerPhone,
                },
              })
              vouchers++
            }
          }
          // The ledger write rides in the same transaction as the status flip,
          // so an order can never read as paid without its donation counted —
          // and never the reverse. recordFundEntry also upserts on
          // (channel, refId), so a double-clicked "Mark paid" cannot count twice
          // even if both requests got past the status check above.
          await recordFundEntry(tx, {
            channel: 'sale',
            refId: line.id,
            amount: line.donationAmount,
          })
          orderTotal += line.unitPrice * line.quantity
          donationTotal += line.donationAmount
        }

        // ONE receipt for the whole order. A 3-line order paid by a single bank
        // transfer is one money-receiving event; recording three rows would not
        // reconcile against the statement. saleId is set only when the order
        // happens to have a single line.
        const payment = await tx.payment.create({
          data: {
            amount: orderTotal,
            method,
            reference,
            receivedBy,
            note,
            orderRef,
            saleId: lines.length === 1 ? lines[0].id : null,
          },
        })

        // Tell the customer the money landed — and, for a service order, that
        // their passes are ready. Queued inside the same transaction as the
        // status flip and the ledger write, so a message can never contradict the
        // money.
        //
        // No expiresAt and no new link: `refType`/`refId` are the same pair the
        // order-placed message used, so ensureLink returns THAT link and the
        // customer is given the one URL they already hold rather than a second
        // working one. A double-clicked "Mark paid" cannot queue a duplicate —
        // the status check above rejects it first, and @@unique([linkId,
        // template]) rejects it even if both requests got through.
        await queueMessage(tx, {
          refType: 'order',
          refId: orderRef,
          template: 'order_paid',
          data: { name: lines[0].customerName, passes: vouchers },
          toName: lines[0].customerName,
          toPhone: lines[0].customerPhone,
        })

        return { lines: lines.length, orderTotal, donationTotal, vouchers, paymentId: payment.id }
      })

      return NextResponse.json({ success: true, action: 'pay', orderRef, ...result })
    }

    const result = await prisma.$transaction(async (tx) => {
      const lines = await tx.sale.findMany({
        where: { orderRef, status: { in: ['pending', 'paid'] } },
      })
      if (lines.length === 0) {
        throw new OrderStateError('This order has nothing left to cancel.')
      }

      let donationRemoved = 0
      for (const line of lines) {
        await tx.sale.update({ where: { id: line.id }, data: { status: 'cancelled' } })
        if (line.status === 'paid') donationRemoved += line.donationAmount
        // Cancels the ledger rows that exist and is a harmless no-op for lines
        // that were never paid. The rows are KEPT as 'cancelled', not deleted,
        // so the fund's history stays auditable — same reasoning as deleting a
        // single sale in ../sales/[id].
        await cancelFundEntry(tx, 'sale', line.id)
      }

      // A customer who was told "paid — your passes are ready" and then has the
      // order cancelled must be told that too, or the receipt they hold keeps
      // saying money was received. Only sent if a phone is on file; for an order
      // placed online there always is one.
      await queueMessage(tx, {
        refType: 'order',
        refId: orderRef,
        template: 'order_cancelled',
        data: { name: lines[0].customerName, orderRef },
        toName: lines[0].customerName,
        toPhone: lines[0].customerPhone,
      })

      // Any Payment already recorded is deliberately LEFT ALONE. If money did
      // arrive, cancelling the order is a refund question, not a reason to
      // erase the record that it was received.
      return { lines: lines.length, donationRemoved }
    })

    return NextResponse.json({ success: true, action: 'cancel', orderRef, ...result })
  } catch (err) {
    if (err instanceof OrderStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not settle this order' }, { status: 500 })
  }
}

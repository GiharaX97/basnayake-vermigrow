import type { Prisma } from '@prisma/client'
import { cancelFundEntry, recordFundEntry } from '@/lib/fund'
import { OrderStateError, type PaymentMethod } from '@/lib/payments'
import { generatePackCodes } from '@/lib/pack-codes'
import { queueMessage, type QueueOutcome } from '@/lib/notify'
import {
  FULFILMENT_ORDER,
  STAGE_TEMPLATES,
  allowedStages,
  deriveFulfilment,
  normaliseStage,
  type FulfilmentStage,
  type FulfilmentStatus,
} from '@/lib/fulfilment'

/**
 * The one place an order's state is moved.
 *
 * Every caller — the admin routes today, the SMS webhook tomorrow — goes through
 * here rather than writing `Sale.fulfillment` or `Sale.status` itself. Two
 * separate writers for one state machine is how an order ends up paid without a
 * ledger row, or delivered twice; keeping the moves in one file is what makes the
 * invariants checkable by reading, not by hoping.
 *
 * Everything here runs INSIDE the caller's transaction. Queueing is free and
 * rides along with the write; sending happens after commit via `autoDeliver`.
 */

export type Actor = 'admin' | 'sms' | 'system'

/**
 * What a stage move did about messaging: the queue's own answer, plus the one
 * outcome that never reaches the queue at all — a step BACK, which is a
 * correction and is deliberately silent.
 *
 * `reverted` is NOT `no_phone`, and the difference reaches the screen. Reusing the
 * queue's "nobody to send to" made the admin UI announce *"No mobile on file"* for
 * an order whose phone number was displayed right beside it — a decision reading
 * as a data fault. The two need separate words because they need separate fixes:
 * one is a missing phone number, the other is nothing being wrong at all.
 */
export type StageMessageOutcome = QueueOutcome | { status: 'reverted' }

/** A client that can be a transaction callback or the plain client. */
type Client = Prisma.TransactionClient

const LIVE_STATUSES = ['pending', 'paid'] as const

/**
 * Move an order's fulfilment stage. Admin-initiated.
 *
 * Requires the order to be fully PAID. Confirming an order nobody has paid for
 * would tell the customer their order is confirmed while the shop is still owed
 * money — and the receipt they hold would disagree. Money is recorded first, by
 * the settle route, and only then can a stage move.
 */
export async function setStageTx(
  tx: Client,
  {
    orderRef,
    stage,
    actor,
    note,
  }: { orderRef: string; stage: FulfilmentStage; actor: Actor; note?: string | null }
): Promise<{
  from: FulfilmentStatus
  to: FulfilmentStage
  lines: number
  message: StageMessageOutcome
}> {
  const lines = await tx.sale.findMany({
    where: { orderRef, status: { in: [...LIVE_STATUSES] } },
    select: {
      id: true,
      status: true,
      fulfillment: true,
      customerName: true,
      customerPhone: true,
    },
  })
  if (lines.length === 0) {
    throw new OrderStateError('This order has no live lines — it was cancelled.')
  }
  if (lines.some((l) => l.status !== 'paid')) {
    throw new OrderStateError(
      'Payment has not been recorded for this order yet — record it before moving the order along.'
    )
  }

  const from = deriveFulfilment(lines)
  if (!allowedStages(from).includes(stage)) {
    throw new OrderStateError(`An order that is ${from} cannot be moved to ${stage}.`)
  }

  const now = new Date()
  await tx.sale.updateMany({
    where: { orderRef, status: { in: [...LIVE_STATUSES] } },
    data: { fulfillment: stage, fulfillmentAt: now },
  })

  // A step BACK is a correction, not news: it gets an event for the audit trail
  // but no text message. Sending "your order is packed" after quietly unpacking
  // it would be worse than saying nothing.
  const reverting = rank(stage) < rank(from)
  await tx.orderEvent.create({
    data: {
      orderRef,
      type: reverting ? 'stage_reverted' : stage,
      fromStage: from,
      toStage: stage,
      actor,
      note: note ?? null,
    },
  })

  if (reverting) {
    return { from, to: stage, lines: lines.length, message: { status: 'reverted' } }
  }

  // Queued inside the transaction, so this message exists if and only if the
  // stage change committed. @@unique([linkId, template]) means a revert followed
  // by a re-advance cannot text the customer twice.
  const message = await queueMessage(tx, {
    refType: 'order',
    refId: orderRef,
    template: STAGE_TEMPLATES[stage],
    data: { name: lines[0].customerName, orderRef },
    toName: lines[0].customerName,
    toPhone: lines[0].customerPhone,
  })

  return { from, to: stage, lines: lines.length, message }
}

/** Position in the pipeline. Shared by the revert test and the transition list. */
function rank(status: FulfilmentStatus): number {
  return FULFILMENT_ORDER.indexOf(status)
}

/**
 * Record that an order's money arrived, and everything that must move with it.
 *
 * Extracted from the admin settle route so the Payments.lk webhook settles an
 * order through the EXACT same transactional path as the "Mark paid" button.
 * That is the point: a card payment must never be able to write a state the
 * manual path cannot, and a second, subtly different settle is how an order ends
 * up paid without a ledger row.
 *
 * Rules preserved verbatim:
 *
 *  - Every pending line flips to paid, with `paymentMethod` recording HOW the
 *    money arrived ('card' for a gateway payment).
 *  - A service line mints one voucher per seat, at `donationAmount: 0` — the
 *    seat's donation is carried by the Sale line, and a non-zero voucher would
 *    count the same seat twice into the public fund. See the Pack model comment.
 *  - The ledger write rides in the same transaction as the status flip, so an
 *    order can never read as paid without its donation counted, nor the reverse.
 *    `recordFundEntry` upserts on (channel, refId), so a replay cannot double-count.
 *  - ONE receipt row per order, because a 3-line order is still one money event.
 *  - The customer's message is queued inside the transaction; the caller sends
 *    it after the commit via autoDeliver.
 *  - Fulfilment is NOT touched. Taking money is not confirming the order.
 *
 * This runs INSIDE the caller's transaction. It returns what the customer was
 * told so the caller can log or display the same figures.
 */
export async function settleOrderTx(
  tx: Client,
  {
    orderRef,
    method,
    reference,
    receivedBy,
    note,
    actor = 'admin',
  }: {
    orderRef: string
    method: PaymentMethod
    reference?: string | null
    receivedBy?: string | null
    note?: string | null
    actor?: Actor
  }
): Promise<{
  lines: number
  orderTotal: number
  donationTotal: number
  vouchers: number
  paymentId: string
}> {
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

    // One voucher per seat, issued at payment — this is the QR the customer
    // shows at the workshop. Minted here rather than at booking so an unpaid
    // order never produces scannable codes.
    if (line.product.kind === 'service') {
      for (const code of generatePackCodes(line.quantity)) {
        await tx.pack.create({
          data: {
            code,
            productId: line.productId,
            // ZERO ON PURPOSE — see the Pack model comment and this file's header.
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
    // The ledger write rides in the same transaction as the status flip, so an
    // order can never read as paid without its donation counted — and never the
    // reverse. recordFundEntry also upserts on (channel, refId), so a double-
    // clicked "Mark paid" or a replayed webhook cannot count twice.
    await recordFundEntry(tx, {
      channel: 'sale',
      refId: line.id,
      amount: line.donationAmount,
    })
    orderTotal += line.unitPrice * line.quantity
    donationTotal += line.donationAmount
  }

  // ONE receipt for the whole order. `saleId` is set only when the order happens
  // to have a single line; a multi-line order settled by one card charge must
  // reconcile against the processor's statement as one row.
  const payment = await tx.payment.create({
    data: {
      amount: orderTotal,
      method,
      reference: reference ?? null,
      receivedBy: receivedBy ?? null,
      note: note ?? null,
      orderRef,
      saleId: lines.length === 1 ? lines[0].id : null,
    },
  })

  // The order's own timeline entry, in the same transaction as the money.
  await tx.orderEvent.create({
    data: { orderRef, type: 'settled', actor, note: note ?? null },
  })

  // Tell the customer the money landed — and, for a service order, that their
  // passes are ready. Queued inside the same transaction, so a message can never
  // contradict the money. The same link and refType as order_placed, so the
  // customer is given the URL they already hold rather than a second one.
  await queueMessage(tx, {
    refType: 'order',
    refId: orderRef,
    template: 'order_paid',
    data: {
      name: lines[0].customerName,
      passes: vouchers,
      donation: donationTotal,
      total: orderTotal,
    },
    toName: lines[0].customerName,
    toPhone: lines[0].customerPhone,
  })

  return { lines: lines.length, orderTotal, donationTotal, vouchers, paymentId: payment.id }
}

/**
 * Cancel an order and everything that must move with it.
 *
 * Extracted verbatim from the settle route so the SMS webhook can reuse the exact
 * same money-safe path instead of growing a second, subtly different cancel. The
 * rules it preserves, all deliberate:
 *
 *  - A PAID line's donation is removed from the public total, and its FundEntry is
 *    marked 'cancelled' rather than deleted, so the fund stays auditable.
 *  - Any recorded `Payment` is LEFT ALONE. If money arrived, cancelling is a
 *    refund question, and erasing the record that it was received would not
 *    answer it.
 *  - Nobody is texted here: the caller queues the message, because only it knows
 *    whether the cancel came from the admin UI or from the customer's own reply.
 */
export async function cancelOrderTx(
  tx: Client,
  { orderRef, actor, note }: { orderRef: string; actor: Actor; note?: string | null }
): Promise<{
  lines: number
  donationRemoved: number
  customerName: string | null
  customerPhone: string | null
}> {
  const lines = await tx.sale.findMany({
    where: { orderRef, status: { in: [...LIVE_STATUSES] } },
  })
  if (lines.length === 0) {
    throw new OrderStateError('This order has nothing left to cancel.')
  }

  let donationRemoved = 0
  for (const line of lines) {
    await tx.sale.update({ where: { id: line.id }, data: { status: 'cancelled' } })
    if (line.status === 'paid') donationRemoved += line.donationAmount
    await cancelFundEntry(tx, 'sale', line.id)
  }

  // Whatever the customer asked for is answered by the cancellation itself, so
  // the flag must not outlive it.
  await tx.sale.updateMany({ where: { orderRef }, data: { cancelRequestedAt: null } })

  await tx.orderEvent.create({
    data: { orderRef, type: 'cancelled', actor, note: note ?? null },
  })

  // Returned so the caller can queue the customer's message without a second
  // query — the caller decides whether anything is said, because only it knows
  // whether the cancel came from the admin UI or the customer's own reply.
  return {
    lines: lines.length,
    donationRemoved,
    customerName: lines[0].customerName,
    customerPhone: lines[0].customerPhone,
  }
}

/** An internal note. Never texted to anybody. */
export async function addNote(
  client: Client,
  { orderRef, note, actor = 'admin' }: { orderRef: string; note: string; actor?: Actor }
): Promise<void> {
  await client.orderEvent.create({
    data: { orderRef, type: 'note', actor, note },
  })
}

/**
 * A customer replied CANCEL about an order that has already been paid for.
 *
 * Nothing is cancelled: money changed hands, so this is a refund decision, and a
 * mistyped or forwarded text must not undo a paid order. The flag is what the
 * admin list and detail page surface, and the customer gets a message that is
 * careful not to claim anything was cancelled.
 */
export async function requestCancelTx(
  tx: Client,
  { orderRef, actor, note }: { orderRef: string; actor: Actor; note?: string | null }
): Promise<{ message: QueueOutcome }> {
  const lines = await tx.sale.findMany({
    where: { orderRef, status: { in: [...LIVE_STATUSES] } },
    select: { customerName: true, customerPhone: true },
  })
  if (lines.length === 0) {
    throw new OrderStateError('This order has no live lines to act on.')
  }

  await tx.sale.updateMany({
    where: { orderRef },
    data: { cancelRequestedAt: new Date() },
  })

  await tx.orderEvent.create({
    data: { orderRef, type: 'cancel_requested', actor, note: note ?? null },
  })

  const message = await queueMessage(tx, {
    refType: 'order',
    refId: orderRef,
    template: 'order_cancel_requested',
    data: { name: lines[0].customerName, orderRef },
    toName: lines[0].customerName,
    toPhone: lines[0].customerPhone,
  })

  return { message }
}

/** The admin decided the cancel request is not going to be honoured. */
export async function dismissCancelRequest(
  client: Client,
  { orderRef, note }: { orderRef: string; note?: string | null }
): Promise<void> {
  await client.sale.updateMany({ where: { orderRef }, data: { cancelRequestedAt: null } })
  await client.orderEvent.create({
    data: {
      orderRef,
      type: 'cancel_request_dismissed',
      actor: 'admin',
      note: note ?? null,
    },
  })
}

/** Re-exported so callers do not have to import from two modules to read a stage. */
export { normaliseStage }

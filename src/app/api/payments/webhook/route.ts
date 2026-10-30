import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { OrderStateError } from '@/lib/payments'
import { autoDeliver } from '@/lib/notify'
import { settleOrderTx } from '@/lib/order-actions'
import {
  parseWebhookEvent,
  paymentsConfig,
  verifyWebhookSignature,
  type WebhookEvent,
} from '@/lib/payments-lk'

/**
 * Payments.lk webhooks: the ONLY thing that can settle a card payment.
 *
 * PUBLIC — the provider is not an admin, so this route cannot sit behind the
 * admin cookie. Its gate is the HMAC in `Payments-Signature`, checked over the
 * RAW body BEFORE a single byte is parsed. An unsigned request is not a request
 * we read.
 *
 * STATUS CODES ARE A CONTRACT, because Payments.lk retries 5xx at
 * 1m/5m/30m/2h/6h/12h and expects a 2xx within 10 seconds:
 *
 *   401 — bad/absent signature. Retrying will not help; nothing was written.
 *   400 — authenticated but not an event we subscribe to. Same reasoning.
 *   200 — handled, duplicated, or deliberately ignored. EVERY outcome where we
 *         understood the event ends here — including "this is for another mode"
 *         and "the order is gone" — because a retry would only decide the same.
 *   500 — we broke. The event row rolls back with the transaction, so the retry
 *         gets a clean second attempt instead of being told a half-applied
 *         settlement succeeded.
 *
 * IDEMPOTENCY. `PaymentWebhookEvent.eventId @unique` is the guard, and the row
 * is written INSIDE the same transaction as the settlement it describes: either
 * both land or neither does. A duplicate delivery trips the unique constraint
 * and is answered 200 without moving money twice.
 */

interface Outcome {
  orderRef: string | null
  note: string
}

/** A narrow, safe view of a Payment object from the webhook body. */
function paymentData(event: WebhookEvent) {
  const d = event.data
  return {
    id: typeof d.id === 'string' ? d.id : null,
    mode: d.mode === 'test' || d.mode === 'live' ? d.mode : event.mode,
    status: typeof d.status === 'string' ? d.status : null,
    amountCents: typeof d.amountCents === 'number' ? d.amountCents : null,
    currency: typeof d.currency === 'string' ? d.currency : null,
    reference: typeof d.reference === 'string' ? d.reference : null,
    checkoutId: typeof d.checkoutId === 'string' ? d.checkoutId : null,
    feeCents: typeof d.feeCents === 'number' ? d.feeCents : null,
    netCents: typeof d.netCents === 'number' ? d.netCents : null,
    failureMessage: typeof d.failureMessage === 'string' ? d.failureMessage : null,
    card:
      typeof d.card === 'object' && d.card !== null
        ? {
            scheme:
              typeof (d.card as Record<string, unknown>).scheme === 'string'
                ? ((d.card as Record<string, unknown>).scheme as string)
                : null,
            last4:
              typeof (d.card as Record<string, unknown>).last4 === 'string'
                ? ((d.card as Record<string, unknown>).last4 as string)
                : null,
          }
        : null,
  }
}

/** Find the intent this event belongs to, from the strongest key to the weakest. */
async function findIntent(tx: Prisma.TransactionClient, event: WebhookEvent) {
  const d = paymentData(event)
  if (d.id) {
    const byPayment = await tx.paymentIntent.findUnique({ where: { paymentId: d.id } })
    if (byPayment) return byPayment
  }
  if (d.checkoutId) {
    const byCheckout = await tx.paymentIntent.findUnique({ where: { checkoutId: d.checkoutId } })
    if (byCheckout) return byCheckout
  }
  // checkout.expired carries the checkout id at the top level, not under a
  // payment object.
  if (event.type === 'checkout.expired') {
    const checkoutId = typeof event.data.id === 'string' ? event.data.id : null
    if (checkoutId) {
      const byCheckout = await tx.paymentIntent.findUnique({ where: { checkoutId } })
      if (byCheckout) return byCheckout
    }
  }
  const orderRef = d.reference ?? (typeof event.data.reference === 'string' ? event.data.reference : null)
  if (orderRef) {
    const byRef = await tx.paymentIntent.findUnique({ where: { orderRef } })
    if (byRef) return byRef
  }
  return null
}

/**
 * Apply one verified event inside the caller's transaction. Returns what we
 * chose to do; the caller stores that on the event row, so "nothing happened and
 * here is why" is visible to an admin instead of living only in a log.
 */
async function applyEvent(
  tx: Prisma.TransactionClient,
  event: WebhookEvent
): Promise<Outcome> {
  const intent = await findIntent(tx, event)
  if (!intent) {
    return { orderRef: null, note: 'No PaymentIntent matches this event; nothing was changed.' }
  }

  const orderRef = intent.orderRef

  // A TEST event must never settle a LIVE order, and vice versa. The intent's
  // mode is the checkout's own mode, so this is the comparison that matters.
  if (event.mode !== intent.mode) {
    return {
      orderRef,
      note: `Refused: event mode ${event.mode} does not match this checkout's mode ${intent.mode}.`,
    }
  }

  if (event.type === 'payment.failed') {
    const d = paymentData(event)
    await tx.paymentIntent.update({
      where: { orderRef },
      data: {
        status: 'failed',
        paymentId: d.id ?? intent.paymentId,
        failureMessage: (d.failureMessage ?? 'The card payment failed.').slice(0, 500),
      },
    })
    return { orderRef, note: 'Card payment failed; the order is still pending.' }
  }

  if (event.type === 'checkout.expired') {
    // Seats stay held on purpose: the customer may still intend to pay at the
    // store, and an expired card page is not an order cancellation. An admin
    // cancels an abandoned order, exactly as before card payments existed.
    if (intent.status === 'open') {
      await tx.paymentIntent.update({ where: { orderRef }, data: { status: 'expired' } })
      return { orderRef, note: 'Checkout expired unpaid; the order is still pending.' }
    }
    return { orderRef, note: `Checkout expired; intent was already ${intent.status}.` }
  }

  // payment.succeeded
  const d = paymentData(event)
  if (d.currency !== 'LKR') {
    return { orderRef, note: `Refused: currency ${d.currency ?? 'missing'} is not LKR.` }
  }
  if (d.amountCents === null || d.amountCents !== intent.amountCents) {
    return {
      orderRef,
      note: `Refused: amount ${d.amountCents ?? 'missing'} cents does not match the checkout's ${intent.amountCents}.`,
    }
  }
  if (intent.status === 'succeeded') {
    return { orderRef, note: 'Already settled by an earlier event; nothing was changed.' }
  }

  try {
    const settled = await settleOrderTx(tx, {
      orderRef,
      method: 'card',
      reference: d.id ?? intent.checkoutId ?? `card-${orderRef}`,
      receivedBy: 'Payments.lk',
      note: d.card?.last4 ? `Card ${d.card.scheme ?? ''} ending ${d.card.last4}`.trim() : 'Card payment',
      actor: 'system',
    })

    await tx.paymentIntent.update({
      where: { orderRef },
      data: {
        status: 'succeeded',
        paymentId: d.id ?? intent.paymentId,
        checkoutId: d.checkoutId ?? intent.checkoutId,
        feeCents: d.feeCents,
        netCents: d.netCents,
        cardScheme: d.card?.scheme ?? null,
        cardLast4: d.card?.last4 ?? null,
        failureMessage: null,
      },
    })

    return {
      orderRef,
      note: `Settled ${settled.lines} line(s), LKR ${(settled.orderTotal).toFixed(2)}, ${settled.vouchers} voucher(s).`,
    }
  } catch (err) {
    // "Already settled / cancelled" is a real answer, not a bug. The money DID
    // arrive, so the intent is marked succeeded either way — the admin needs to
    // see a card charge against an order that was closed by hand, because that
    // is a refund decision. No second Payment row is written.
    if (err instanceof OrderStateError) {
      await tx.paymentIntent.update({
        where: { orderRef },
        data: {
          status: 'succeeded',
          paymentId: d.id ?? intent.paymentId,
          feeCents: d.feeCents,
          netCents: d.netCents,
          cardScheme: d.card?.scheme ?? null,
          cardLast4: d.card?.last4 ?? null,
          failureMessage: `Money received, but the order could not be settled: ${err.message} Refund/refund-check needed.`,
        },
      })
      return { orderRef, note: `Money received but not applied: ${err.message}` }
    }
    throw err
  }
}

export async function POST(request: Request) {
  const raw = await request.text()
  const cfg = paymentsConfig()

  if (!cfg.webhookSecret) {
    // Refusing is the only honest answer: without the key there is no way to tell
    // a genuine event from anyone on the internet posting JSON. Loud on the
    // server, opaque to the caller.
    console.error('[payments-webhook] PAYMENTS_LK_WEBHOOK_SECRET is not set — events cannot be verified')
    return NextResponse.json(
      { error: 'This endpoint is not configured to accept events.' },
      { status: 503 }
    )
  }

  const check = verifyWebhookSignature(raw, request.headers.get('payments-signature'), [
    cfg.webhookSecret,
  ])
  if (!check.ok) {
    console.warn(`[payments-webhook] rejected an event: ${check.reason}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = parseWebhookEvent(raw)
  if (!event) {
    return NextResponse.json({ error: 'Not an event we understand' }, { status: 400 })
  }

  // The header id and the body id are the same event. If a proxy or a fault ever
  // makes them disagree, the body is authoritative and the difference is logged.
  const headerId = request.headers.get('payments-event-id')
  if (headerId && headerId !== event.id) {
    console.warn(`[payments-webhook] event id header ${headerId} differs from body ${event.id}`)
  }

  let outcome: Outcome
  try {
    outcome = await prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          mode: event.mode,
          rawPayload: raw,
        },
      })

      const result = await applyEvent(tx, event)

      await tx.paymentWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          orderRef: result.orderRef,
          note: result.note,
          processedAt: new Date(),
        },
      })

      return result
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      // The same event, delivered twice. The first delivery already did the work.
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[payments-webhook] could not process an event', err)
    // Rolled back, so the event row is gone and the retry starts clean.
    return NextResponse.json({ error: 'Could not process this event' }, { status: 500 })
  }

  // After the commit, never inside it: the provider must not hold our write
  // lock, and a send failure must not undo a settlement. This is what texts the
  // customer "we received your payment" and drains the order's queue.
  if (outcome.orderRef) {
    try {
      await autoDeliver(prisma, 'order', outcome.orderRef)
    } catch (err) {
      // The settlement is already real and the message stays queued for retry.
      // Answering 500 here would make the provider redeliver an event we handled.
      console.error('[payments-webhook] settled, but the follow-up send failed', err)
    }
  }

  return NextResponse.json({ received: true, orderRef: outcome.orderRef, note: outcome.note })
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
  )
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed — this endpoint accepts Payments.lk webhook POSTs only.' },
    { status: 405 }
  )
}

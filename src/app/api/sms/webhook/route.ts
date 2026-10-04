import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OrderStateError } from '@/lib/payments'
import { autoDeliver } from '@/lib/notify'
import {
  applyInboundEvent,
  parseWebhookEvent,
  type InboundOutcome,
} from '@/lib/sms/inbound'
import { WEBHOOK_SECRET_ENV, bearerToken, verifyHs256Jwt } from '@/lib/sms/webhook-verify'

/**
 * Inbound httpSMS events: delivery receipts, and customers texting back.
 *
 * PUBLIC — httpSMS is not an admin, so this route cannot sit behind the admin
 * cookie. Its only gate is the signed JWT in the `Authorization` header, which is
 * why the signature is checked FIRST, before a single byte of the body is parsed.
 * An unsigned request is not a request we read.
 *
 * STATUS CODES ARE A CONTRACT, because httpSMS retries 5xx up to four times:
 *
 *   401 — bad/absent signature. Retrying will not help; nothing was written.
 *   400 — authenticated but not event-shaped. Same reasoning.
 *   200 — handled, duplicated, or deliberately ignored. EVERY outcome where we
 *         understood the event ends here, including "we chose to do nothing",
 *         because a retry would only produce the same decision again.
 *   500 — we broke. The event row rolls back with the transaction, so the
 *         gateway's retry gets a clean second attempt rather than being told a
 *         half-applied change succeeded.
 *
 * IDEMPOTENCY. `SmsEvent.@@unique([eventType, providerMessageId])` is the guard,
 * and the insert lives INSIDE the same transaction as the effect it describes:
 * either both land or neither does. That is what makes a retry safe — a duplicate
 * trips the unique constraint and is answered 200 without the effect running
 * twice, while a failure leaves no record behind to block the retry that follows.
 *
 *   (The one hole, stated plainly: SQLite treats NULLs as distinct in a unique
 *   index, so an event that carries no message id is not deduplicated. Those are
 *   heartbeats and the like, which are stored and ignored, so a duplicate costs a
 *   row and no action.)
 */
export async function POST(request: Request) {
  const secret = process.env[WEBHOOK_SECRET_ENV]
  if (!secret) {
    // Refusing is the only honest answer: without the key there is no way to tell
    // a genuine event from anyone on the internet posting JSON. Loud on the
    // server, opaque to the caller.
    console.error(
      `[sms-webhook] ${WEBHOOK_SECRET_ENV} is not set — inbound events cannot be verified and were refused`
    )
    return NextResponse.json(
      { error: 'This endpoint is not configured to accept events.' },
      { status: 503 }
    )
  }

  const token = bearerToken(request.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const verified = verifyHs256Jwt(token, secret)
  if (!verified.ok) {
    // The reason is worth having in the log — an expired clock and a wrong key
    // look identical from the outside, and only one of them is a config problem.
    console.warn(`[sms-webhook] rejected an event: ${verified.error}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await request.text()
  let body: unknown = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    // Not fatal on its own: the signed claims carry the same fields, and
    // parseWebhookEvent falls back to them. A gateway that posts a body we cannot
    // read should still have its event honoured when it signed for it.
    body = null
  }

  const parsed = parseWebhookEvent(
    body,
    request.headers.get('x-event-type'),
    verified.payload ?? null
  )
  if (!parsed) {
    return NextResponse.json({ error: 'Not an event we understand' }, { status: 400 })
  }

  let outcome: InboundOutcome
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const event = await tx.smsEvent.create({
        data: {
          eventType: parsed.eventType,
          providerMessageId: parsed.providerMessageId,
          from: parsed.contact,
          to: parsed.owner,
          body: parsed.body,
          payload: raw || '{}',
        },
        select: { id: true },
      })

      let result: InboundOutcome
      try {
        result = await applyInboundEvent(tx, parsed)
      } catch (err) {
        // A REFUSAL is not a bug. "This order was already cancelled" is a real
        // answer, and it is recorded rather than thrown away — but the caller
        // must not see it as a failure, because httpSMS would retry a decision
        // that will never change.
        //
        // Safe to commit the partial work here: the order helpers validate
        // before they write, so an OrderStateError means nothing was touched.
        if (!(err instanceof OrderStateError)) throw err
        await tx.smsEvent.update({
          where: { id: event.id },
          data: { error: err.message, processedAt: new Date() },
        })
        return { orderRef: null, note: err.message }
      }

      await tx.smsEvent.update({
        where: { id: event.id },
        data: {
          orderRef: result.orderRef,
          // `error` is the table's only free-text column, so it holds the reason
          // an event produced no action as well as real failures. For an admin
          // reading the history, "already confirmed" belongs in exactly the same
          // place as "we could not match this number".
          error: result.note,
          processedAt: new Date(),
        },
      })
      return result
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      // The same event, delivered twice. The first one already did the work.
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[sms-webhook] could not process an event', err)
    // Rolled back, so the SmsEvent row is gone too and the retry starts clean.
    return NextResponse.json({ error: 'Could not process this event' }, { status: 500 })
  }

  // After the commit, never inside it: the gateway must not hold our write lock,
  // and a send failure must not undo a status change that already happened. This
  // is what actually texts the customer when their own reply moved the order, and
  // it also drains anything else queued for that order.
  if (outcome.orderRef) {
    try {
      await autoDeliver(prisma, 'order', outcome.orderRef)
    } catch (err) {
      // The event is already recorded and the order already moved. A send failure
      // is visible in the Messages tab and can be retried by hand; turning it into
      // a 500 here would make httpSMS redeliver an event we have handled.
      console.error('[sms-webhook] event handled but the follow-up send failed', err)
    }
  }

  return NextResponse.json({ received: true, orderRef: outcome.orderRef, note: outcome.note })
}

/** Prisma's P2002, without importing the client namespace for one comparison. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
  )
}

/**
 * httpSMS documents POST only. Answered rather than left to 405 so a
 * misconfigured dashboard gets a sentence instead of a blank rejection.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed — this endpoint accepts httpSMS webhook POSTs only.' },
    { status: 405 }
  )
}

import type { Prisma } from '@prisma/client'
import { deriveOrderStatus } from '@/lib/payments'
import { queueMessage } from '@/lib/notify'
import { cancelOrderTx, requestCancelTx, setStageTx } from '@/lib/order-actions'
import { FULFILMENT_LABELS, deriveFulfilment } from '@/lib/fulfilment'
import { toE164 } from './msisdn'

/**
 * What an incoming httpSMS webhook means, and what — if anything — it does to an
 * order.
 *
 * Kept out of the route so the policy is readable and testable on its own. The
 * route's job is signature, idempotency and status codes; the DECISIONS live
 * here, which is the part worth being able to read in one sitting.
 *
 * TWO KINDS OF EVENT ARRIVE:
 *
 *  1. **Delivery receipts** — the phone telling us what became of a message we
 *     sent. This only ever writes `deliveryStatus`/`deliveredAt` on the
 *     CustomerMessage. It never touches money, seats or an order's stage.
 *  2. **Replies** — the customer texting us back. This is the only inbound path
 *     that can move an order, and the policy below is deliberately timid: an
 *     unrecognised reply does nothing, an ambiguous number does nothing, and the
 *     one irreversible action (cancelling) is refused outright on a paid order.
 */

/** The one reply-driven event. Everything else here is a receipt. */
export const EVENT_RECEIVED = 'message.phone.received'

/**
 * httpSMS event → the value written to `CustomerMessage.deliveryStatus`.
 *
 * `message.phone.sent` means the message left the handset, which is NOT the same
 * as our own `status = 'sent'` (we handed it to the gateway). The two are kept
 * apart on purpose: a message can be `status: 'sent'` and
 * `deliveryStatus: 'failed'`, and that combination is the truth — we did our
 * part, the phone could not do its.
 */
const DELIVERY_STATES: Record<string, string> = {
  'message.phone.sent': 'sent',
  'message.phone.delivered': 'delivered',
  'message.send.failed': 'failed',
  'message.send.expired': 'expired',
}

/** How far back a reply may reach. Older orders are not what a text is about. */
const MATCH_WINDOW_DAYS = 14

export interface ParsedEvent {
  eventType: string
  /** The gateway's id for the message. The join key for a delivery receipt. */
  providerMessageId: string | null
  /** Our own CustomerMessage id, echoed back. The fallback join key. */
  providerRequestId: string | null
  /** The other party's number: the customer, in both directions. */
  contact: string | null
  /** The farm's own number. */
  owner: string | null
  body: string | null
  /** Why a send failed, when the event says. */
  reason: string | null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Read an event out of whatever httpSMS posted.
 *
 * The documented body is a CloudEvents envelope (`{ type, id, data: {...} }`)
 * with `X-Event-Type` and a signed JWT carrying the same claims. All three
 * sources are accepted rather than betting on one: an event we cannot read is an
 * event we silently drop, and the failure mode of guessing wrong here is a
 * customer's CANCEL vanishing.
 *
 * Returns null only when there is nothing event-shaped at all.
 */
export function parseWebhookEvent(
  body: unknown,
  eventTypeHeader: string | null,
  jwtPayload: Record<string, unknown> | null
): ParsedEvent | null {
  const envelope = (body ?? {}) as Record<string, unknown>
  const claims = (jwtPayload ?? {}) as Record<string, unknown>

  const eventType =
    str(envelope.type) ?? str(eventTypeHeader) ?? str(claims.type) ?? ''

  // `data` when the envelope is real; otherwise the body itself is the payload.
  const data = (
    envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope
  ) as Record<string, unknown>
  const claimData = (
    claims.data && typeof claims.data === 'object' ? claims.data : claims
  ) as Record<string, unknown>

  // httpSMS is NOT consistent about what the message id is called, and it is
  // worth spelling out because getting it wrong fails silently:
  //
  //   id          — message.phone.sent, message.phone.delivered, message.send.failed
  //   message_id  — message.phone.received, message.send.expired, message.call.missed
  //
  // Reading only `id` would leave every REPLY without a key — i.e. the whole
  // CONFIRM/CANCEL feature would have no idempotency — while the delivery
  // receipts kept working perfectly and hid the problem. Found by reading the
  // gateway's docs, which the tests could not do: they build their own payloads,
  // so they verify the logic against the shape they assume, not the real one.
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = data[key] ?? claimData[key]
      if (value !== undefined && value !== null) return value
    }
    return undefined
  }

  const providerMessageId = str(pick('id', 'message_id'))
  const parsed: ParsedEvent = {
    eventType,
    providerMessageId,
    providerRequestId: str(pick('request_id')),
    contact: str(pick('contact')),
    owner: str(pick('owner')),
    body: str(pick('content')),
    // The documented field is `error_message` (e.g. "MOBILE_APP_INACTIVE").
    // `reason` is kept as a fallback because it costs nothing and this gateway
    // is evidently not fussy about naming.
    reason: str(pick('error_message', 'reason')),
  }

  // An event with neither a type nor anything to act on is not an event.
  if (!parsed.eventType && !parsed.providerMessageId && !parsed.body) return null
  return parsed
}

/* -------------------------------------------------------------- keywords -- */

export type Keyword = 'confirm' | 'cancel' | null

/**
 * The whole message, without punctuation or case: "Confirm." and "CONFIRM" are
 * the same word.
 */
function normaliseReply(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

/** Short forms that must be the ENTIRE message. */
const BARE_CONFIRM = new Set(['CONFIRM', 'YES', 'Y', '1', 'OK'])
const BARE_CANCEL = new Set(['CANCEL', 'NO', 'N', '0'])

/** Words allowed to LEAD a longer sentence, e.g. "CANCEL my order please". */
const LEAD_WORDS = new Set(['CONFIRM', 'CANCEL'])

/** A leading word is only a command if the message is still short. */
const MAX_SENTENCE_WORDS = 4

/**
 * Read a reply as a command, or null.
 *
 * The rule is asymmetric ON PURPOSE, and the asymmetry is the safety property:
 *
 *  - The bare short forms must be the WHOLE message. "no problem, thanks" must
 *    never cancel an order, so a lone `NO` counts and a `NO` inside a sentence
 *    does not.
 *  - Only CONFIRM and CANCEL may open a longer sentence, because they are
 *    unambiguous as a first word: "cancel my order please" is a person asking to
 *    cancel, while "no, don't cancel" would be read backwards by a naive prefix
 *    match.
 *
 * Everything else — including STOP, which in SMS means "unsubscribe" rather than
 * "cancel my order" — is unrecognised, which means: no action, and the message is
 * still shown to the admin so a human can read it.
 */
export function parseKeyword(raw: string | null): Keyword {
  if (!raw) return null
  const norm = normaliseReply(raw)
  if (!norm) return null
  if (BARE_CONFIRM.has(norm)) return 'confirm'
  if (BARE_CANCEL.has(norm)) return 'cancel'

  const words = norm.split(' ')
  if (words.length > 1 && words.length <= MAX_SENTENCE_WORDS && LEAD_WORDS.has(words[0]!)) {
    return words[0] === 'CONFIRM' ? 'confirm' : 'cancel'
  }
  return null
}

/* --------------------------------------------------------------- matching -- */

export interface OrderMatch {
  orderRef: string | null
  /** How many live orders share this number. >1 means we refuse to guess. */
  candidates: number
}

/**
 * The order a reply is about: the newest LIVE order for that phone number.
 *
 * Only when there is EXACTLY ONE candidate. A shared phone (a shop's number, a
 * family phone) can appear on several orders, and the two commands do very
 * different things: CONFIRM advances a stage, CANCEL on an unpaid order releases
 * seats and cancels it. Guessing which order a bare "0" meant is not something a
 * machine should do with someone's booking, so ambiguity is recorded for the
 * admin and nothing moves.
 *
 * Numbers are compared in E.164 because the stored column holds whatever the
 * customer typed ('0771234567', '+94 77 123 4567') while the webhook sends
 * `+94771234567`; comparing the raw strings would match almost nothing.
 */
export async function findOrderForPhone(
  tx: Prisma.TransactionClient,
  phone: string | null,
  now = new Date()
): Promise<OrderMatch> {
  const target = toE164(phone ?? '')
  if (!target) return { orderRef: null, candidates: 0 }

  const since = new Date(now.getTime() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const recent = await tx.sale.findMany({
    where: {
      source: 'online',
      orderRef: { not: null },
      status: { in: ['pending', 'paid'] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { orderRef: true, customerPhone: true },
    take: 300,
  })

  // Newest first, and one entry per order — so the first match is the newest
  // order that number has.
  const seen = new Set<string>()
  const matches: string[] = []
  for (const line of recent) {
    const ref = line.orderRef
    if (!ref || seen.has(ref)) continue
    seen.add(ref)
    if (toE164(line.customerPhone ?? '') === target) matches.push(ref)
  }

  if (matches.length === 0) return { orderRef: null, candidates: 0 }
  if (matches.length > 1) return { orderRef: null, candidates: matches.length }
  return { orderRef: matches[0]!, candidates: 1 }
}

/* ---------------------------------------------------------------- effects -- */

export interface InboundOutcome {
  orderRef: string | null
  /**
   * Why the event produced no action — stored on the SmsEvent and visible to the
   * admin. Not every one of these is a failure: "already confirmed" is a fact
   * worth keeping, and the field is the only free text the table has.
   */
  note: string | null
}

/**
 * A delivery receipt: the phone reporting what became of a message we sent.
 *
 * Matched by the gateway's message id first, then by our own id, because a send
 * whose response was lost still carries `request_id`. Writes ONLY the delivery
 * columns — never `status`, never an order. A message that failed to arrive is
 * still a message we sent, and saying otherwise would put a paid order's receipt
 * back in the outbox to be sent twice.
 */
async function applyDeliveryReceipt(
  tx: Prisma.TransactionClient,
  parsed: ParsedEvent
): Promise<InboundOutcome> {
  const state = DELIVERY_STATES[parsed.eventType]
  if (!state) return { orderRef: null, note: `unhandled event type ${parsed.eventType}` }

  const message = parsed.providerMessageId
    ? await tx.customerMessage.findFirst({
        where: { providerMessageId: parsed.providerMessageId },
        select: { id: true, link: { select: { refType: true, refId: true } } },
      })
    : null
  const byRequestId =
    message ??
    (parsed.providerRequestId
      ? await tx.customerMessage.findUnique({
          where: { id: parsed.providerRequestId },
          select: { id: true, link: { select: { refType: true, refId: true } } },
        })
      : null)

  if (!byRequestId) {
    return {
      orderRef: null,
      note: `no message matched ${
        parsed.providerMessageId ?? parsed.providerRequestId ?? 'an event with no id'
      }`,
    }
  }

  await tx.customerMessage.update({
    where: { id: byRequestId.id },
    data: {
      deliveryStatus: state,
      // Only a delivery stamps this. A 'sent' event means it left the phone, and
      // writing a delivery time for that would be a small lie the admin would
      // eventually act on.
      ...(state === 'delivered' ? { deliveredAt: new Date() } : {}),
      ...(state === 'failed' || state === 'expired'
        ? { error: parsed.reason ?? `The phone reported the message ${state}` }
        : {}),
    },
  })

  const link = byRequestId.link
  return {
    orderRef: link.refType === 'order' ? link.refId : null,
    note: null,
  }
}

/**
 * A reply from the customer.
 *
 * The policy table, all of it deliberate:
 *
 * | Reply   | Order state      | What happens                                   |
 * |---------|------------------|------------------------------------------------|
 * | CONFIRM | paid, stage new  | the order advances to Confirmed (they are texted) |
 * | CONFIRM | paid, moved on   | nothing — recorded, because they may just be keen |
 * | CONFIRM | unpaid           | NOTHING. Money is an admin decision; a text is not payment |
 * | CANCEL  | unpaid           | cancelled, through the same path the admin uses |
 * | CANCEL  | PAID             | flagged for the office. NEVER cancelled — the money moved |
 * | other   | —                | nothing; the message is stored for a human to read |
 */
async function applyReply(
  tx: Prisma.TransactionClient,
  parsed: ParsedEvent
): Promise<InboundOutcome> {
  const keyword = parseKeyword(parsed.body)
  if (!keyword) {
    return { orderRef: null, note: 'reply not recognised as CONFIRM or CANCEL' }
  }

  const match = await findOrderForPhone(tx, parsed.contact)
  if (!match.orderRef) {
    return {
      orderRef: null,
      note:
        match.candidates > 1
          ? `ambiguous: ${match.candidates} live orders share this number — nothing was changed`
          : 'no live order matches this number',
    }
  }

  const orderRef = match.orderRef
  const lines = await tx.sale.findMany({
    where: { orderRef },
    select: { status: true, fulfillment: true },
  })
  if (lines.length === 0) return { orderRef, note: 'the matched order has no lines' }

  const status = deriveOrderStatus(lines.map((l) => l.status))
  if (status === 'cancelled') {
    return { orderRef, note: 'the matched order was already cancelled' }
  }

  if (keyword === 'confirm') {
    if (status !== 'paid') {
      // The one place a customer's enthusiasm must not move anything: telling
      // them their order is confirmed while the shop is still owed money would
      // contradict the receipt in their hand.
      await tx.orderEvent.create({
        data: {
          orderRef,
          type: 'sms_inbound',
          actor: 'sms',
          note: 'Customer replied CONFIRM, but the order is not paid yet — an admin must record the payment first.',
        },
      })
      return { orderRef, note: 'CONFIRM received on an unpaid order — recorded, not acted on' }
    }

    // The stage is folded up with the same rule the admin UI uses, so a reply
    // and a button press agree about what "already confirmed" means.
    const stage = deriveFulfilment(lines)
    if (stage !== 'new') {
      await tx.orderEvent.create({
        data: {
          orderRef,
          type: 'sms_inbound',
          actor: 'sms',
          note: `Customer replied CONFIRM; the order is already ${FULFILMENT_LABELS[stage]}.`,
        },
      })
      return {
        orderRef,
        note: `CONFIRM received but the order is already ${FULFILMENT_LABELS[stage]}`,
      }
    }

    await setStageTx(tx, {
      orderRef,
      stage: 'confirmed',
      actor: 'sms',
      note: 'Customer replied CONFIRM.',
    })
    return { orderRef, note: 'CONFIRM advanced the order to Confirmed' }
  }

  /* CANCEL */
  if (status === 'paid' || status === 'mixed') {
    // Money changed hands. A mistyped — or forwarded — "0" must not undo a paid
    // order, so this raises a flag for a human and says nothing that could be
    // read as "cancelled".
    await requestCancelTx(tx, {
      orderRef,
      actor: 'sms',
      note: 'Customer replied CANCEL to a paid order.',
    })
    return { orderRef, note: 'CANCEL on a paid order — flagged for the office, not cancelled' }
  }

  // Unpaid: no money moved, so there is nothing to refund and the seats can go
  // back. The same path the admin's Cancel button takes, so the two cannot drift.
  const cancelled = await cancelOrderTx(tx, {
    orderRef,
    actor: 'sms',
    note: 'Customer replied CANCEL.',
  })
  await queueMessage(tx, {
    refType: 'order',
    refId: orderRef,
    template: 'order_cancelled',
    data: { name: cancelled.customerName, orderRef },
    toName: cancelled.customerName,
    toPhone: cancelled.customerPhone,
  })
  return { orderRef, note: 'CANCEL cancelled an unpaid order' }
}

/** Route an event to its handler. Runs inside the caller's transaction. */
export async function applyInboundEvent(
  tx: Prisma.TransactionClient,
  parsed: ParsedEvent
): Promise<InboundOutcome> {
  if (parsed.eventType === EVENT_RECEIVED) return applyReply(tx, parsed)
  return applyDeliveryReceipt(tx, parsed)
}

import { randomBytes } from 'crypto'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { formatLkr } from '@/lib/currency'

/**
 * Telling customers what they did.
 *
 * The shape mirrors src/lib/fund.ts deliberately: one shared writer, called
 * INSIDE the caller's transaction, with idempotency enforced by a unique
 * constraint rather than by asking "have I already done this?" at every call
 * site. A message is owed if and only if the event that produced it committed —
 * so a rolled-back payment can never text somebody "we received your money".
 *
 * WHAT THIS FILE DOES NOT DO IS SEND. Queueing is free and happens in the
 * transaction; delivery is a separate, human-triggered step (see deliverMessage
 * below). That split is not a shortcut — it is the safety property. Both public
 * writers (/api/orders and the donor-wall claim) accept a phone number from an
 * anonymous caller, behind a throttle that keys on a spoofable x-forwarded-for.
 * Auto-sending from those paths would hand a stranger a paid SMS primitive
 * aimed at whatever number they typed.
 */

/** Where a message's subject lives. Mirrors `CustomerLink.refType`. */
export type RefType = 'order' | 'pack' | 'donation' | 'sale'

/**
 * What kind of message this is. One template per real event — there is no
 * marketing here, and a template is never reused across two different events.
 *
 * `order_cancelled` exists because cancelling a PAID order is reachable (the
 * settle endpoint's cancel branch accepts `status: { in: ['pending','paid'] }`).
 * Without it, a customer told "paid — here are your passes" would never be told
 * otherwise, and the receipt would keep showing money received.
 */
export type Template =
  | 'order_placed'
  | 'order_paid'
  | 'order_cancelled'
  | 'sale_thanks'
  | 'scan_thanks'
  | 'gift_thanks'

/** The subset of the Prisma client these helpers need — client or tx callback. */
type NotifyClient = Prisma.TransactionClient

/* ------------------------------------------------------------------ phone -- */

/**
 * One phone vocabulary for the whole app. This is the exact expression the
 * public order form has always enforced (src/app/api/orders/route.ts); it is
 * shared rather than re-typed so the admin forms cannot drift into accepting
 * something the public form rejects.
 */
export const PHONE_REGEX = /^[+\d][\d\s\-()]{8,19}$/

/** Required phone, for the public order form's `customerPhone`. */
export const requiredPhone = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(9, 'Please enter a valid phone number')
      .max(20, 'Phone number is too long')
      .regex(PHONE_REGEX, 'Please enter a valid phone number')
  )

/**
 * Optional phone, for the admin forms and the wall claim. Empty string and
 * absent are both normalised to null so a blank field means "no message" rather
 * than "message to nowhere".
 */
export const optionalPhone = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? null : v),
  z
    .string()
    .trim()
    .min(9, 'Please enter a valid phone number')
    .max(20, 'Phone number is too long')
    .regex(PHONE_REGEX, 'Please enter a valid phone number')
    .nullable()
)

/**
 * Show a phone without publishing it. Used by the receipt page, which is a
 * public URL: the customer already knows their own number, so the full value
 * buys them nothing and costs plenty if the link is forwarded or the phone is
 * handed across a counter. `+94771234567` -> `+94 77 *** 4567`.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.length <= 4) return '••••'
  const head = digits.slice(0, 3)
  const tail = digits.slice(-4)
  return `${head} ••• ${tail}`
}

/* ------------------------------------------------------------------ token -- */

/**
 * The key to a customer's receipt page.
 *
 * 24 CSPRNG bytes, base64url — 192 bits in 32 URL-safe characters. The length
 * is the point: the admin session token (src/lib/admin-auth.ts) uses 48 bytes
 * hex, which is 96 characters and unusable in an SMS.
 *
 * TWO THINGS MUST NEVER CHANGE ABOUT THIS VALUE:
 *
 * 1. It is CASE-SENSITIVE. base64url is mixed-case, and this codebase has a
 *    habit of normalising codes on lookup — `.toUpperCase()` in the scan route
 *    and the pack routes. Copying that habit into the receipt lookup would
 *    silently break every token containing an uppercase character. The receipt
 *    route must query the token exactly as received.
 *
 * 2. It is a WRITE capability. See the CustomerLink schema comment: a service
 *    receipt can reveal workshop QR codes, and scanning one redeems it.
 */
export function generateReceiptToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Absolute origin for links we put in messages. */
export function siteBaseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? 'http://localhost:3001').replace(/\/+$/, '')
}

export function receiptUrl(token: string): string {
  return `${siteBaseUrl()}/r/${token}`
}

/* --------------------------------------------------------------- the link -- */

/**
 * Get or create the one link that covers a record. Idempotent on
 * `@@unique([refType, refId])`, so queueing the second message about an order
 * reuses the URL the customer was already given rather than minting a new one.
 *
 * `expiresAt` is set on the FIRST call and never rewritten — a later message
 * must not quietly extend a link that was deliberately given a deadline.
 */
export async function ensureLink(
  client: NotifyClient,
  { refType, refId, expiresAt }: { refType: RefType; refId: string; expiresAt?: Date | null }
): Promise<{ id: string; token: string }> {
  const existing = await client.customerLink.findUnique({
    where: { refType_refId: { refType, refId } },
    select: { id: true, token: true },
  })
  if (existing) return existing

  try {
    return await client.customerLink.create({
      data: { token: generateReceiptToken(), refType, refId, expiresAt: expiresAt ?? null },
      select: { id: true, token: true },
    })
  } catch {
    // Lost a race with a concurrent writer for the same record. The winner's
    // row is the one that stands — its token may already be in a sent message.
    const raced = await client.customerLink.findUnique({
      where: { refType_refId: { refType, refId } },
      select: { id: true, token: true },
    })
    if (!raced) throw new Error('Could not establish a receipt link')
    return raced
  }
}

/**
 * How long a receipt stays open. A workshop pass must outlive the workshop, so
 * a service link is anchored to the event date rather than to the booking;
 * everything else gets a flat window.
 */
export function linkExpiry(eventDate?: Date | null): Date {
  const DAY = 24 * 60 * 60 * 1000
  if (eventDate) return new Date(eventDate.getTime() + 30 * DAY)
  return new Date(Date.now() + 180 * DAY)
}

/* ------------------------------------------------------------ the message -- */

/** Inputs a template may interpolate. All optional; renderMessage is defensive. */
export interface MessageData {
  name?: string | null
  orderRef?: string | null
  total?: number | null
  amount?: number | null
  passes?: number | null
  url: string
}

function hi(name?: string | null): string {
  const trimmed = name?.trim()
  return trimmed ? `${trimmed}, ` : ''
}

/**
 * Render the text of a message. PURE AND NON-THROWING BY CONTRACT.
 *
 * This runs inside the caller's transaction, so anything that throws here rolls
 * back a payment. Every field is therefore optional and every branch has a
 * fallback: a missing name yields a shorter sentence, never an exception. Do
 * not add a call, a query or a lookup to this function.
 *
 * Bodies are kept short on purpose — a long SMS is billed as several, and the
 * carrier splits it into parts that can arrive out of order.
 */
export function renderMessage(template: Template, data: MessageData): string {
  const { name, orderRef, total, amount, passes, url } = data
  const ref = orderRef ?? ''

  switch (template) {
    case 'order_placed':
      return (
        `${hi(name)}we have your order ${ref}` +
        (total ? ` for ${formatLkr(total)}` : '') +
        `. We will call you to arrange payment. See it anytime: ${url}`
      )

    case 'order_paid':
      // Names no reference, on purpose, and carries no QR code. The link and the
      // reference are the two halves of the receipt gate; putting both in one
      // message would hand them to whoever the message is forwarded to, which is
      // exactly the case the gate exists for. The reference was sent when the
      // order was placed.
      return (
        `${hi(name)}we received your payment. Thank you!` +
        (passes
          ? ` Your ${passes === 1 ? 'workshop pass is' : `${passes} workshop passes are`} ready — open ${url} and enter the reference we sent when you booked.`
          : ` Your receipt: ${url}`)
      )

    case 'order_cancelled':
      return `${hi(name)}order ${ref} has been cancelled. Nothing further is owed. If this is unexpected, please call us.`

    case 'sale_thanks':
      // The total is its own sentence rather than a clause glued on with "and".
      // A product whose catalog price is 0 (nothing configured yet) yields
      // total 0, and the glued shape then read "…buying from us. and LKR 60 of
      // it went to the community fund." — a dangling connective in a message a
      // real customer receives. Two sentences work whether or not there is a
      // total to state.
      return (
        `${hi(name)}thank you for buying from us.` +
        (total ? ` Your purchase was ${formatLkr(total)}.` : '') +
        ` ${formatLkr(amount ?? 0)} of it went to the community fund. Receipt: ${url}`
      )

    case 'scan_thanks':
      return (
        `${hi(name)}thank you! Your pack added ${formatLkr(amount ?? 0)} to the community fund. ` +
        `See the wall: ${url}`
      )

    case 'gift_thanks':
      return (
        `${hi(name)}thank you for your gift of ${formatLkr(amount ?? 0)} to the community fund. ` +
        `Your receipt: ${url}`
      )

    default:
      // Unreachable for a well-typed caller; returns the link rather than
      // throwing, because a throw here would roll back the money movement.
      return `${hi(name)}here is your receipt: ${url}`
  }
}

export interface QueueMessageInput {
  refType: RefType
  refId: string
  template: Template
  data: Omit<MessageData, 'url'>
  toName?: string | null
  toPhone?: string | null
  /** Set on first link creation only. */
  expiresAt?: Date | null
}

/**
 * What happened to a queue request. A three-way answer rather than a boolean,
 * because the three cases need different reactions:
 *
 *   queued    — a row is waiting. Send it.
 *   duplicate — this exact event is already queued. Nothing to do; first write
 *               wins, so the outstanding body is the one describing the event as
 *               it was. Distinct from 'queued' so a caller can log it: a
 *               swallowed genuine second event looks exactly like a working
 *               system until a customer complains.
 *   no_phone  — nobody to send to, so NO row and NO link were created.
 */
export type QueueOutcome =
  | { status: 'queued'; messageId: string; token: string }
  | { status: 'duplicate'; token: string }
  | { status: 'no_phone' }

/**
 * Queue one message. Idempotent on `@@unique([linkId, template])`.
 *
 * A message exists if and only if it can actually be sent: with no phone number
 * there is nothing to do, and a queued row that can never leave would turn the
 * Messages tab into a list of things nobody can action. This is why the caller
 * does not decide — the rule lives here, in one place. Note the consequence: a
 * record with no phone gets no receipt link either, since the link's only
 * delivery mechanism is the message.
 *
 * MUST NOT do network I/O. It runs inside the caller's transaction, so anything
 * that can hang or throw here can roll back a payment.
 */
export async function queueMessage(
  client: NotifyClient,
  input: QueueMessageInput
): Promise<QueueOutcome> {
  const toPhone = input.toPhone?.trim() || null
  if (!toPhone) return { status: 'no_phone' }

  const link = await ensureLink(client, {
    refType: input.refType,
    refId: input.refId,
    expiresAt: input.expiresAt,
  })

  const body = renderMessage(input.template, { ...input.data, url: receiptUrl(link.token) })

  try {
    const created = await client.customerMessage.create({
      data: {
        linkId: link.id,
        template: input.template,
        body,
        toName: input.toName?.trim() || null,
        toPhone,
        status: 'queued',
      },
      select: { id: true },
    })
    return { status: 'queued', messageId: created.id, token: link.token }
  } catch {
    return { status: 'duplicate', token: link.token }
  }
}

/* ------------------------------------------------------------- transport -- */

/**
 * How a queued message leaves the building.
 *
 * `manual` is the default and needs no configuration at all: the admin copies
 * the text, or taps a link that opens their own phone's SMS app prefilled. It
 * costs nothing and works today.
 *
 * `http` posts to a gateway. It is inert until the three variables below are
 * set in the server's environment file (/etc/basnayakavermigrow.env on the VPS —
 * deliberately not in git, and not editable from the admin UI, because this app
 * has no encryption-at-rest helper and no code path that reads a secret back out
 * of the database).
 */
export type Transport = 'manual' | 'http'

export function activeTransport(): Transport {
  return process.env.SMS_GATEWAY_URL ? 'http' : 'manual'
}

export interface DeliveryResult {
  ok: boolean
  error?: string
}

/**
 * POST the message to the configured gateway.
 *
 * Deliberately never throws: a provider outage must mark a message failed, not
 * turn into a 500 that leaves the admin unsure whether anything was sent.
 */
export async function sendViaGateway(to: string, body: string): Promise<DeliveryResult> {
  const url = process.env.SMS_GATEWAY_URL
  if (!url) return { ok: false, error: 'No SMS gateway configured' }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SMS_GATEWAY_KEY
          ? { Authorization: `Bearer ${process.env.SMS_GATEWAY_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        to,
        message: body,
        sender: process.env.SMS_SENDER_ID ?? undefined,
      }),
      // A gateway that hangs must not hang the admin request with it.
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `${res.status} ${text.slice(0, 200)}`.trim() }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' }
  }
}

/**
 * Send a queued message, or record that the admin already sent it by hand.
 *
 * CALL ONLY FROM AN AUTHENTICATED ADMIN ROUTE. See the CustomerMessage schema
 * comment: both public writers accept a phone number from an anonymous caller
 * behind a throttle keyed on a spoofable header, so an unauthenticated path to
 * this function is a paid-SMS primitive aimed at any number an attacker picks.
 *
 * On the manual transport nothing is transmitted — the admin sends from their
 * own phone and this records that it happened. On the http transport the row is
 * CLAIMED FIRST and the gateway call happens after, so two admins tapping Send
 * simultaneously produce one text rather than two; the cost of that ordering is
 * that a crash between the claim and the call leaves a row marked sent that
 * never went out, which is why the provider's answer is written to `error`.
 */
export async function deliverMessage(
  client: NotifyClient,
  id: string,
  sentBy: string | null
): Promise<{ ok: boolean; error?: string; already?: boolean }> {
  const message = await client.customerMessage.findUnique({
    where: { id },
    select: { status: true, toPhone: true, body: true },
  })
  if (!message) return { ok: false, error: 'Message not found' }
  if (message.status === 'sent') return { ok: false, already: true, error: 'Already sent' }
  if (!message.toPhone) return { ok: false, error: 'No phone number on this message' }

  if (activeTransport() === 'manual') {
    // Nothing to transmit: the admin has sent it from their own phone. Record it.
    const claimed = await client.customerMessage.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'sent', sentAt: new Date(), sentBy, error: null },
    })
    return claimed.count === 0
      ? { ok: false, already: true, error: 'Already sent' }
      : { ok: true }
  }

  const claimed = await client.customerMessage.updateMany({
    where: { id, status: 'queued' },
    data: { status: 'sent', sentAt: new Date(), sentBy },
  })
  if (claimed.count === 0) return { ok: false, already: true, error: 'Already sent' }

  const result = await sendViaGateway(message.toPhone, message.body)
  if (!result.ok) {
    await client.customerMessage.update({
      where: { id },
      data: { status: 'failed', error: result.error ?? 'Send failed' },
    })
    return { ok: false, error: result.error }
  }
  return { ok: true }
}

/**
 * Take a receipt link out of circulation. Every message for that record stays
 * readable in the admin, but /r/<token> stops resolving and the action that
 * reveals workshop passes stops answering — both to the same 404, so a revoked
 * link is indistinguishable from one that never existed.
 *
 * This is the real answer to a leaked link. The reference gate in front of the
 * voucher codes is defence against link previews and casual disclosure, not
 * against a deliberate forwarder; revocation is what covers that.
 */
export async function revokeLink(client: NotifyClient, linkId: string): Promise<void> {
  await client.customerLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
  })
}

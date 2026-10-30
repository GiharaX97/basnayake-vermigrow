import { randomBytes } from 'crypto'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { formatLkr } from '@/lib/currency'
import { toGsm7 } from '@/lib/sms/gsm7'

/**
 * Telling customers what they did.
 *
 * The shape mirrors src/lib/fund.ts deliberately: one shared writer, called
 * INSIDE the caller's transaction, with idempotency enforced by a unique
 * constraint rather than by asking "have I already done this?" at every call
 * site. A message is owed if and only if the event that produced it committed —
 * so a rolled-back payment can never text somebody "we received your money".
 *
 * QUEUEING AND SENDING ARE ALWAYS SEPARATE STEPS. Queueing happens inside the
 * transaction and is free; sending is a network call that can hang, cost money
 * and fail, and must never be able to roll back a payment or a fund entry. So
 * every event queues (queueMessage), and delivery happens afterwards, outside the
 * transaction, through autoDeliver — which callers fire only once the money has
 * actually moved.
 *
 * autoDeliver STILL REQUIRES A CONFIGURED GATEWAY. With none, the transport is
 * 'manual' and it does nothing at all: writing status='sent' for a message that
 * was never transmitted is a false record of delivery, worse than a queue a human
 * has to work through. That also keeps the public writers safe by default — see
 * the transport section and src/lib/sms/.
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
  // One per fulfilment stage an admin can move an order to (src/lib/fulfilment.ts).
  // Each is queued in the same transaction as the stage change, so the customer is
  // told only about a move that actually committed.
  | 'order_confirmed'
  | 'order_packed'
  | 'order_dispatched'
  | 'order_delivered'
  // NOT a cancellation: the customer asked to cancel an order they had already
  // paid for, and a human now has to decide. Saying "cancelled" here would be a
  // lie, and would contradict the receipt they hold.
  | 'order_cancel_requested'
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
  /**
   * What this purchase put into Apeksha Hospital — the figure the customer
   * actually asked about. Distinct from `amount`, which for a service sale is the
   * seat price and only coincides with the donation while nothing else is
   * configured.
   */
  donation?: number | null
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
function renderRawMessage(template: Template, data: MessageData): string {
  const { name, orderRef, total, amount, donation, passes, url } = data
  const ref = orderRef ?? ''

  /**
   * Whether a figure is worth stating. A non-finite or absent value is omitted
   * rather than printed as LKR 0 — but an explicit 0 IS stated, because "nothing
   * went to the fund" is a real answer to give a customer, and silently dropping
   * it would read as though the donation had been forgotten.
   */
  const statesDonation = typeof donation === 'number' && Number.isFinite(donation)

  /** "order VG-O-ABC123", or a wording that still reads when no ref was given. */
  const refText = ref ? `order ${ref}` : 'your order'

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
      //
      // The donation IS named: an amount is not a credential, and an online buyer
      // is owed the same answer a counter customer gets from sale_thanks.
      return (
        `${hi(name)}we received your payment` +
        (total ? ` of ${formatLkr(total)}` : '') +
        `. Thank you!` +
        (statesDonation ? ` ${formatLkr(donation as number)} of it went to Apeksha Hospital.` : '') +
        (passes
          ? ` Your ${passes === 1 ? 'workshop pass is' : `${passes} workshop passes are`} ready — open ${url} and enter the reference we sent when you booked.`
          : ` Your receipt: ${url}`) +
        // The one message that invites a reply, because it is the one a customer
        // has a reason to answer: "we have your money" is exactly the moment to
        // confirm the order or say something is wrong. The words are the whole
        // interface — there is no app, and a reply that says "yeah ok" is handled
        // as unrecognised rather than guessed at.
        ` Reply CONFIRM to confirm your order, or CANCEL if you need to change it.`
      )

    case 'order_cancelled':
      return `${hi(name)}order ${ref} has been cancelled. Nothing further is owed. If this is unexpected, please call us.`

    // The four fulfilment stages. Short, one sentence each, and — like
    // order_cancelled above — NO url and no codes. The receipt link and the order
    // reference are the two halves of the voucher gate on /r/<token>; a status
    // text must never hand out both, and it has nothing to do with money, so it
    // states none.
    case 'order_confirmed':
      // The CANCEL offer is repeated here, and nowhere else: this is the last
      // stage before anything is packed, so it is the last moment a change costs
      // the farm nothing. After this the customer is told to call instead.
      return `${hi(name)}${refText} is confirmed. We will let you know when it is on the way. Reply CANCEL if anything changes.`

    case 'order_packed':
      return `${hi(name)}${refText} is packed and getting ready to go.`

    case 'order_dispatched':
      return `${hi(name)}${refText} is on its way to you.`

    case 'order_delivered':
      return `${hi(name)}${refText} has been delivered. Thank you for buying from us!`

    // Not a cancellation, and worded so it cannot be mistaken for one — the
    // customer still holds a receipt saying they paid, and that stays true until
    // an admin decides what to do.
    case 'order_cancel_requested':
      return `${hi(name)}we have your request about ${refText}. As payment was already received, our team will call you to sort it out.`

    case 'sale_thanks':
      // The total is its own sentence rather than a clause glued on with "and".
      // A product whose catalog price is 0 (nothing configured yet) yields
      // total 0, and the glued shape then read "…buying from us. and LKR 60 of
      // it went to Apeksha Hospital." — a dangling connective in a message a
      // real customer receives. Two sentences work whether or not there is a
      // total to state.
      return (
        `${hi(name)}thank you for buying from us.` +
        (total ? ` Your purchase was ${formatLkr(total)}.` : '') +
        ` ${formatLkr(amount ?? 0)} of it went to Apeksha Hospital. Receipt: ${url}`
      )

    case 'scan_thanks':
      return (
        `${hi(name)}thank you! Your pack added ${formatLkr(amount ?? 0)} to Apeksha Hospital. ` +
        `See the wall: ${url}`
      )

    case 'gift_thanks':
      return (
        `${hi(name)}thank you for your gift of ${formatLkr(amount ?? 0)} to Apeksha Hospital. ` +
        `Your receipt: ${url}`
      )

    default:
      // Unreachable for a well-typed caller; returns the link rather than
      // throwing, because a throw here would roll back the money movement.
      return `${hi(name)}here is your receipt: ${url}`
  }
}

/**
 * Render a template into the text a customer actually receives.
 *
 * The raw render is pushed through `toGsm7` before it leaves this module, so the
 * body stored on CustomerMessage is exactly the body transmitted. Doing it here,
 * rather than in each provider, is what makes that true — and it catches every
 * source of a stray character at once, the amount formatter and a customer's own
 * name alike, because this is the single point every template passes through.
 * See src/lib/sms/gsm7.ts for the arithmetic and the measured bill behind it.
 *
 * This does not make a long message cheap: it halves the cost of a message that
 * was already being billed at double. The length advice above still stands.
 */
export function renderMessage(template: Template, data: MessageData): string {
  return toGsm7(renderRawMessage(template, data))
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
 * `http` hands the message to a gateway. WHICH gateway — and what it needs — is
 * src/lib/sms/'s business; this file only asks whether anything transmits and, if
 * so, passes the text over. Credentials live in the server's environment file
 * (/etc/basnayakavermigrow.env on the VPS — deliberately not in git, and not
 * editable from the admin UI, because this app has no encryption-at-rest helper
 * and no code path that reads a secret back out of the database).
 *
 * Re-exported rather than reimplemented so the delivery decision has exactly one
 * definition; a second copy of "do we actually send?" is how a system ends up
 * recording messages as sent that were never transmitted.
 */
import { activeTransport, sendSms as sendViaGateway } from '@/lib/sms'

export { activeTransport, sendViaGateway }
export type { Transport } from '@/lib/sms'

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

  // The message id goes WITH the send: it is what a later delivery receipt quotes
  // back at us, so without it the outbox can never learn that a text arrived. Only
  // written when the gateway gave one — overwriting a good id with null on a
  // re-send that returned nothing would lose the only link we have.
  const result = await sendViaGateway(message.toPhone, message.body, { requestId: id })
  if (!result.ok) {
    // sentAt AND sentBy ARE CLEARED, not left behind. The claim above stamped
    // them optimistically so a crash mid-send would not leave the row looking
    // queued; but now that the provider has actually refused, leaving them would
    // make the admin list read "Sent 14:02 by auto" over a message nobody got,
    // which is exactly the false record of delivery this file exists to prevent.
    // status='failed' means not sent, so the sent-* columns say so too.
    await client.customerMessage.update({
      where: { id },
      data: { status: 'failed', error: result.error ?? 'Send failed', sentAt: null, sentBy: null },
    })
    return { ok: false, error: result.error }
  }
  if (result.providerMessageId) {
    await client.customerMessage.update({
      where: { id },
      // `deliveryStatus` is deliberately NOT set here. A 2xx means the gateway
      // accepted the message, not that it went anywhere, and the only writer of
      // delivery state is the webhook that reports what actually happened.
      data: { providerMessageId: result.providerMessageId },
    })
  }
  return { ok: true }
}

/* ------------------------------------------------------------- auto-send -- */

/**
 * The sentBy marker for machine-sent messages. Kept distinct from 'admin'
 * because the daily cap counts only these: a ceiling meant to bound what the
 * software does on its own must never block a human deciding to send one more.
 */
export const AUTO_SENT_BY = 'auto'

/** Automatic sends allowed per local day, across the whole system. */
export function smsDailyCap(): number {
  const raw = Number.parseInt(process.env.SMS_DAILY_CAP ?? '', 10)
  return Number.isFinite(raw) && raw >= 0 ? raw : 200
}

/** SMS_AUTOSEND=off (or false/0) stops automatic sending without a redeploy. */
export function autoSendEnabled(): boolean {
  const raw = (process.env.SMS_AUTOSEND ?? '').trim().toLowerCase()
  return !(raw === 'off' || raw === 'false' || raw === '0')
}

/**
 * How many messages the system has sent on its own since local midnight. Counts
 * only `sentBy = 'auto'`: a message a human pressed Send on is not what the
 * ceiling is there to bound, and counting it would let one busy morning lock the
 * automation out for the rest of the day.
 */
export async function autoSentToday(client: NotifyClient): Promise<number> {
  // Server-local midnight. The VPS runs UTC, so the window is a UTC day — close
  // enough for a spend ceiling, and it needs no timezone dependency to compute.
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  return client.customerMessage.count({
    where: { status: 'sent', sentBy: AUTO_SENT_BY, sentAt: { gte: midnight } },
  })
}

export interface AutoSendResult {
  sent: number
  failed: number
  /** Still queued — held back by the cap, for a human to send or skip. */
  held: number
  /** Why nothing (or less than everything) happened. For logs, never for the customer. */
  reason?: string
}

/**
 * Send whatever the last committed event queued.
 *
 * CALL THIS AFTER THE TRANSACTION COMMITS, WITH THE PLAIN PRISMA CLIENT. Passing
 * the transaction client would put gateway HTTP calls inside the money
 * transaction, where one slow gateway would hold a database write lock open — and
 * the entire separation this file is built around would be undone. The
 * corresponding guarantee is that a message can exist for an event that
 * committed, but never for one that rolled back.
 *
 * THREE THINGS STOP IT, ALL ON PURPOSE:
 *
 * 1. No gateway configured. `activeTransport()` is 'manual', so there is nothing
 *    to transmit. Returning early is not laziness — the alternative is marking
 *    messages 'sent' that no one ever received.
 * 2. SMS_AUTOSEND=off. A kill switch that does not need a deploy.
 * 3. The daily cap. /api/donations is public and its throttle keys on a
 *    spoofable x-forwarded-for, so an attacker rotating that header could
 *    otherwise spend the farm's SMS credit on numbers of their choosing. The cap
 *    bounds the whole system's autonomous spend to a number the owner can
 *    predict; whatever it holds back stays queued and visible in the admin.
 *
 * Note the cap is checked per call and counted from committed rows, so two
 * callers running at once can overshoot by a few messages. It is a spend ceiling,
 * not a quota — overshooting slightly is the acceptable failure.
 *
 * IT SENDS THE WHOLE QUEUE FOR THAT RECORD, OLDEST FIRST, NOT JUST THE NEWEST
 * MESSAGE. That is not tidiness. An order placed online queues order_placed and
 * nothing else — placement is not a sale, so nothing is transmitted then — and
 * order_paid deliberately does not repeat the order reference, it refers back to
 * "the reference we sent when you booked". Sending only the newest message would
 * deliver that sentence to somebody who was never sent the reference. Draining
 * the backlog in order is what makes the later message make sense, and it is why
 * an order that sat unpaid for a week still tells a coherent story when it is
 * finally settled.
 *
 * Nothing here throws: it runs after the customer's request has already
 * succeeded, so a gateway outage must not turn a completed sale into an error.
 */
export async function autoDeliver(
  client: NotifyClient,
  refType: RefType,
  refId: string
): Promise<AutoSendResult> {
  const nothing = (reason: string): AutoSendResult => ({ sent: 0, failed: 0, held: 0, reason })

  try {
    if (!autoSendEnabled()) return nothing('automatic sending disabled (SMS_AUTOSEND)')
    if (activeTransport() === 'manual') {
      return nothing('no gateway configured — messages stay queued for manual sending')
    }

    const link = await client.customerLink.findUnique({
      where: { refType_refId: { refType, refId } },
      select: { id: true },
    })
    if (!link) return nothing('nothing was queued for this record')

    const queued = await client.customerMessage.findMany({
      where: { linkId: link.id, status: 'queued' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (queued.length === 0) return nothing('no queued messages')

    const room = smsDailyCap() - (await autoSentToday(client))
    if (room <= 0) return { sent: 0, failed: 0, held: queued.length, reason: 'daily cap reached' }

    let sent = 0
    let failed = 0
    let held = 0

    for (const message of queued) {
      if (sent >= room) {
        held++
        continue
      }
      const result = await deliverMessage(client, message.id, AUTO_SENT_BY)
      if (result.ok) sent++
      // `already` means an admin tapped Send first. It is out of the queue and was
      // never ours to send, so it counts as neither a send nor a failure.
      else if (!result.already) failed++
    }

    return held > 0
      ? { sent, failed, held, reason: 'daily cap reached' }
      : { sent, failed, held }
  } catch (err) {
    // The events that call this have already committed. A failure here — the
    // database refusing a write, a provider throwing against its contract — must
    // stay a log line, not become the response to a sale that did happen.
    return {
      sent: 0,
      failed: 0,
      held: 0,
      reason: err instanceof Error ? `auto-send failed: ${err.message}` : 'auto-send failed',
    }
  }
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

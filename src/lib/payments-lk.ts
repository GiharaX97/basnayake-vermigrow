import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Payments.lk — hosted checkout + signed webhooks. Server-only.
 *
 * The contract here was read from the provider's own OpenAPI document
 * (https://api.payments.lk/v1/openapi.json), never from memory:
 *
 *  - One host for both modes. The KEY PREFIX decides test vs live
 *    (sk_test_… / sk_live_…); there is no separate sandbox host.
 *  - POST /v1/checkouts requires an Idempotency-Key header (8–255 chars,
 *    remembered 24h per mode).
 *  - Amounts are INTEGER LKR CENTS (Rs. 10 = 1000). The spec says "take it from
 *    your own records, never from the browser" — so nothing in this file accepts
 *    an amount that came from a request body.
 *  - The checkout response carries `id` (chk_…), `url`, `expiresAt` (30 min) and
 *    the nested `payment.id` (pay_…).
 *  - Webhook = `Payments-Signature: t=<unix>,v1=<hex HMAC-SHA256("<t>.<rawBody>")>`
 *    with a 300 s tolerance. During rotation the header carries one `v1` per
 *    secret and any match is acceptable. Verify over the RAW body, before parsing.
 *  - Fulfil from `payment.succeeded`. `successUrl` "proves nothing"; the browser
 *    return never settles anything.
 *
 * The secret key is never logged, never returned, and never sent anywhere except
 * the provider. Errors thrown from here are safe to show an admin.
 */

const API_BASE = 'https://api.payments.lk'

/** Provider limits, in integer LKR cents. */
export const PAYMENTS_MIN_CENTS = 1000 // Rs. 10
export const PAYMENTS_MAX_CENTS = 100_000_000 // Rs. 1,000,000

export const ALLOWED_EVENT_TYPES = [
  'payment.succeeded',
  'payment.failed',
  'checkout.expired',
] as const

export type PaymentsEventType = (typeof ALLOWED_EVENT_TYPES)[number]
export type PaymentsMode = 'test' | 'live'

export interface WebhookEvent {
  id: string
  type: PaymentsEventType
  mode: PaymentsMode
  created: string | null
  data: Record<string, unknown>
}

/**
 * What the app can do with the current environment.
 *
 * `demo` is a deliberate fallback for demonstrating the whole order → pay →
 * settled → SMS flow on a machine with no provider keys: it accepts a locally
 * signed webhook against `/order/demo-pay`, exercising the SAME signature check
 * and settlement path. It is off unless `PAYMENTS_LK_DEMO=1` AND no secret key is
 * set, so it can never shadow a real account.
 *
 * A webhook secret is required in every mode — without one there is no way to
 * tell a genuine event from anyone on the internet posting JSON.
 */
export interface PaymentsConfig {
  enabled: boolean
  demo: boolean
  mode: PaymentsMode | null
  secretKey: string | null
  webhookSecret: string | null
  /** Why card payment is unavailable, for the server log only. */
  reason: string | null
}

export function paymentsConfig(): PaymentsConfig {
  const secretKey = process.env.PAYMENTS_LK_SECRET_KEY?.trim() || null
  const webhookSecret = process.env.PAYMENTS_LK_WEBHOOK_SECRET?.trim() || null
  const declared = process.env.PAYMENTS_LK_MODE?.trim().toLowerCase()
  const demo = process.env.PAYMENTS_LK_DEMO === '1' && !secretKey

  let mode: PaymentsMode | null = null
  if (declared === 'test' || declared === 'live') mode = declared
  else if (secretKey?.startsWith('sk_live_')) mode = 'live'
  else if (secretKey?.startsWith('sk_test_')) mode = 'test'
  else if (demo) mode = 'test'

  if (!webhookSecret) {
    return {
      enabled: false,
      demo: false,
      mode: null,
      secretKey,
      webhookSecret,
      reason: 'PAYMENTS_LK_WEBHOOK_SECRET is not set',
    }
  }
  if (!secretKey && !demo) {
    return {
      enabled: false,
      demo: false,
      mode: null,
      secretKey,
      webhookSecret,
      reason: 'PAYMENTS_LK_SECRET_KEY is not set',
    }
  }
  if (!secretKey && demo) {
    return { enabled: true, demo: true, mode: 'test', secretKey, webhookSecret, reason: null }
  }
  if (!mode) {
    return {
      enabled: false,
      demo: false,
      mode: null,
      secretKey,
      webhookSecret,
      reason: 'PAYMENTS_LK_SECRET_KEY does not look like sk_test_… or sk_live_…',
    }
  }
  return { enabled: true, demo: false, mode, secretKey, webhookSecret, reason: null }
}

/** True when the customer should be offered "Pay by card". */
export function cardPaymentEnabled(): boolean {
  return paymentsConfig().enabled
}

/** Whether this deployment is the no-keys demo fallback (server-side only). */
export function paymentsDemoMode(): boolean {
  return paymentsConfig().demo
}

// ---------------------------------------------------------------------------
// Webhook signatures
// ---------------------------------------------------------------------------

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Verify `Payments-Signature` over the RAW body.
 *
 * `secrets` is a list so a rotated secret can be accepted while both are live:
 * the provider sends one `v1` per secret, and any match is enough. The comparison
 * is constant-time. A missing/old timestamp is refused, because otherwise a body
 * captured once could be replayed forever.
 *
 * Call this BEFORE parsing the body. An unsigned request is not a request we read.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secrets: string[],
  { toleranceSeconds = 300, nowMs = Date.now() }: { toleranceSeconds?: number; nowMs?: number } = {}
): SignatureCheck {
  if (!header) return { ok: false, reason: 'missing Payments-Signature header' }

  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    if (key === 't') {
      const n = Number(value)
      if (Number.isFinite(n) && n > 0) timestamp = n
    } else if (key === 'v1' && /^[0-9a-fA-F]+$/.test(value)) {
      signatures.push(value)
    }
  }

  if (timestamp === null) return { ok: false, reason: 'signature header has no valid t=' }
  if (signatures.length === 0) return { ok: false, reason: 'signature header has no v1=' }

  const ageSeconds = Math.abs(nowMs / 1000 - timestamp)
  if (ageSeconds > toleranceSeconds) {
    return { ok: false, reason: `timestamp is ${Math.round(ageSeconds)}s away (tolerance ${toleranceSeconds}s)` }
  }

  const candidates = secrets.filter((s) => s.length > 0)
  if (candidates.length === 0) return { ok: false, reason: 'no webhook secret configured' }

  for (const secret of candidates) {
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest()
    for (const signature of signatures) {
      const given = Buffer.from(signature, 'hex')
      if (given.length === expected.length && timingSafeEqual(given, expected)) {
        return { ok: true }
      }
    }
  }
  return { ok: false, reason: 'no v1= matches any configured secret' }
}

/**
 * Parse a verified event body. Returns null for anything we do not subscribe to
 * or cannot understand — the route answers 400 for those, because a retry would
 * not change the answer.
 */
export function parseWebhookEvent(rawBody: string): WebhookEvent | null {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const e = body as Record<string, unknown>
  if (typeof e.id !== 'string' || e.id.length === 0) return null
  if (typeof e.type !== 'string' || !ALLOWED_EVENT_TYPES.includes(e.type as PaymentsEventType)) return null
  if (e.mode !== 'test' && e.mode !== 'live') return null
  if (typeof e.data !== 'object' || e.data === null) return null
  return {
    id: e.id,
    type: e.type as PaymentsEventType,
    mode: e.mode,
    created: typeof e.created === 'string' ? e.created : null,
    data: e.data as Record<string, unknown>,
  }
}

// ---------------------------------------------------------------------------
// Checkout creation
// ---------------------------------------------------------------------------

export interface CreateCheckoutInput {
  amountCents: number
  description: string
  reference: string
  successUrl: string
  cancelUrl: string
  customer?: { name: string; email?: string | null; phone?: string | null } | null
  idempotencyKey: string
}

export interface CreateCheckoutResult {
  checkoutId: string
  paymentId: string | null
  url: string
  expiresAt: string | null
  mode: PaymentsMode | null
}

/** Thrown when the provider refuses or cannot be reached. Message is admin-safe. */
export class PaymentsLkError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'PaymentsLkError'
  }
}

/**
 * Create a hosted checkout for an order. Idempotent on `idempotencyKey`: a
 * retried request (double-clicked button, network retry) returns the SAME
 * checkout for 24 hours instead of taking a second payment.
 */
export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  const cfg = paymentsConfig()
  if (!cfg.enabled || !cfg.secretKey) {
    throw new PaymentsLkError('Card payment is not configured on this site yet.', 503)
  }
  if (!Number.isInteger(input.amountCents)) {
    throw new PaymentsLkError('The order total is not a whole number of cents.', 400)
  }
  if (input.amountCents < PAYMENTS_MIN_CENTS) {
    throw new PaymentsLkError('Card payments start at Rs. 10.', 409)
  }
  if (input.amountCents > PAYMENTS_MAX_CENTS) {
    throw new PaymentsLkError('This order is above the card limit — please call us.', 409)
  }
  if (!/^[A-Za-z0-9_\-:.]{8,255}$/.test(input.idempotencyKey)) {
    throw new PaymentsLkError('Invalid idempotency key.', 500)
  }

  const body: Record<string, unknown> = {
    amountCents: input.amountCents,
    description: input.description.slice(0, 120),
    reference: input.reference.slice(0, 64),
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  }
  // The provider requires BOTH name and email when `customer` is present, so an
  // order without an email address is simply sent without customer details —
  // the checkout page then asks for them. Name-only is not a valid shape.
  if (input.customer?.name && input.customer.email) {
    body.customer = {
      name: input.customer.name.slice(0, 80),
      email: input.customer.email.slice(0, 254),
      ...(input.customer.phone ? { phone: input.customer.phone } : {}),
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}/v1/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    })
  } catch (err) {
    // Never include the request headers in this message: they carry the key.
    const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'could not be reached'
    throw new PaymentsLkError(`The card processor ${reason}. Please try again.`, 502)
  }

  const text = await response.text()
  if (!response.ok) {
    // The provider's error sentence is safe to show an admin; cap it so a stray
    // HTML page cannot flood the UI, and never echo our request.
    let detail = text.slice(0, 300)
    try {
      const parsed = JSON.parse(text) as { message?: unknown; error?: unknown }
      const msg = parsed.message ?? parsed.error
      if (typeof msg === 'string') detail = msg.slice(0, 300)
    } catch {
      /* keep the clipped body */
    }
    console.error(`[payments-lk] checkout refused: HTTP ${response.status} ${detail}`)
    throw new PaymentsLkError(
      `The card processor refused this checkout (HTTP ${response.status}). Please try again or pay at the store.`,
      502
    )
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new PaymentsLkError('The card processor returned an unreadable answer.', 502)
  }

  const checkoutId = typeof parsed.id === 'string' ? parsed.id : null
  const url = typeof parsed.url === 'string' ? parsed.url : null
  const payment = typeof parsed.payment === 'object' && parsed.payment !== null
    ? (parsed.payment as Record<string, unknown>)
    : null
  const paymentId = typeof payment?.id === 'string' ? payment.id : null
  const expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null
  const mode = parsed.mode === 'test' || parsed.mode === 'live' ? parsed.mode : null

  if (!checkoutId || !url) {
    throw new PaymentsLkError('The card processor did not return a checkout URL.', 502)
  }
  return { checkoutId, paymentId, url, expiresAt, mode }
}

/** Read a checkout back. Used by the admin Reconcile action, never by the customer. */
export async function retrieveCheckout(checkoutId: string): Promise<Record<string, unknown>> {
  const cfg = paymentsConfig()
  if (!cfg.enabled || !cfg.secretKey) {
    throw new PaymentsLkError('Card payment is not configured on this site yet.', 503)
  }
  let response: Response
  try {
    response = await fetch(`${API_BASE}/v1/checkouts/${encodeURIComponent(checkoutId)}`, {
      headers: { Authorization: `Bearer ${cfg.secretKey}` },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new PaymentsLkError('The card processor could not be reached.', 502)
  }
  if (!response.ok) {
    throw new PaymentsLkError(`The card processor answered HTTP ${response.status}.`, 502)
  }
  return (await response.json()) as Record<string, unknown>
}

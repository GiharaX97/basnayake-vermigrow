import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientIp, createThrottle } from '@/lib/throttle'
import {
  ONLINE_RETAILER,
  MAX_ORDER_LINES,
  MAX_PRODUCT_QTY,
  MAX_SERVICE_QTY,
  CapacityError,
  assertSeatsAvailable,
  generateOrderRef,
} from '@/lib/orders'
import { queueMessage, linkExpiry, autoDeliver } from '@/lib/notify'
import { z } from 'zod'

/**
 * Place an order. PUBLIC endpoint: it writes money-bearing rows with no login.
 *
 * What it deliberately does NOT do: take a price, a donation amount, a retailer
 * or a status from the client. The client sends product ids and quantities, and
 * every figure is re-derived from the database here. A client that posts
 * `donationAmount: 0` or `price: 1` changes nothing.
 *
 * Orders are created `pending` and contribute NOTHING to the donation fund until
 * an admin confirms the money arrived — which is the whole point of the gate.
 * There is no payment gateway (all money is offline), so this endpoint records
 * intent; the admin records receipt.
 */

/** Per-IP: a walk-in customer orders once. Five in 30 min is already generous. */
const orderThrottle = createThrottle({ windowMs: 30 * 60 * 1000, max: 5 })
/**
 * Global ceiling. `x-forwarded-for` is spoofable, so a per-IP limit alone bounds
 * nothing — an attacker rotates the header and writes rows forever. This is the
 * backstop that actually caps the damage.
 */
const orderGlobalThrottle = createThrottle({ windowMs: 60 * 60 * 1000, max: 60 })

/** Refuse oversized bodies before parsing them. */
const MAX_BODY_BYTES = 16 * 1024

const orderSchema = z.object({
  customerName: z
    .string()
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, 'Please enter your name').max(80, 'Name is too long')),
  customerPhone: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(9, 'Please enter a valid phone number')
        .max(20, 'Phone number is too long')
        // Sri Lankan mobile/landline in local or +94 form, with optional spaces,
        // dashes and brackets.
        .regex(/^[+\d][\d\s\-()]{8,19}$/, 'Please enter a valid phone number')
    ),
  customerEmail: z
    .union([z.string().trim().email('Please enter a valid email').max(120), z.literal('')])
    .optional(),
  note: z.string().trim().max(500, 'Note is too long').optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        // Upper bound is the loosest cap; the per-kind cap is applied below once
        // we know whether the item is a product or a service.
        quantity: z.coerce.number().int('Must be a whole number').min(1, 'Must be at least 1').max(MAX_PRODUCT_QTY),
      })
    )
    .min(1, 'Your order is empty')
    .max(MAX_ORDER_LINES, `An order can hold at most ${MAX_ORDER_LINES} items`),
})

/** Prisma write conflict / SQLite lock contention — worth exactly one retry. */
function isBusyError(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  if (code === 'P2034') return true
  const msg = e instanceof Error ? e.message : ''
  return /SQLITE_BUSY|database is locked|write conflict/i.test(msg)
}

/** The host of a URL, or null if it will not parse. */
function hostOf(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/**
 * Reject cross-origin posts. A browser sends `Origin` on cross-origin POSTs, so
 * a mismatch here means another site is trying to place orders as this one. An
 * absent header is allowed — it cannot be verified, and the throttle still
 * applies — rather than breaking clients that legitimately omit it.
 *
 * "Us" cannot be a single value. Match the Origin against *every* host this
 * request could legitimately have arrived on:
 *
 *  - `x-forwarded-host` — what the browser actually used, when a tunnel or
 *    reverse proxy is in front. Without this an order placed through the public
 *    URL was refused with 403: Next sees the request's own host as the internal
 *    `localhost:3001`, which matches neither the Origin nor NEXTAUTH_URL (both
 *    also localhost). Only the first entry is read — the rest of the chain is
 *    the proxy's own addressing, not the client's.
 *  - `host` and the request URL — direct access, no proxy.
 *  - NEXTAUTH_URL — the configured public URL.
 *
 * Trusting a forwarded header here is not a CSRF hole: a page cannot set `Host`
 * or `Origin`, and adding `X-Forwarded-Host` to a cross-origin request makes it
 * non-simple, so the browser sends a preflight that this route never approves.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  const from = hostOf(origin)
  if (!from) return false

  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  return [forwarded, request.headers.get('host'), hostOf(request.url), hostOf(process.env.NEXTAUTH_URL)]
    .some((host) => host === from)
}

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Order is too large' }, { status: 413 })
  }

  const ip = clientIp(request)
  // Per-IP first, so a single abuser is stopped without spending the global
  // allowance that protects everyone else.
  if (orderThrottle.check(ip) || orderGlobalThrottle.check('global')) {
    return NextResponse.json(
      { error: 'Too many orders from this connection. Please try again later, or call us.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Honeypot: a field hidden from humans. Filled in means a bot walked the form.
  // Checked before validation so the response gives nothing away, and rejected
  // rather than silently dropped — a false positive from a browser autofilling a
  // hidden field must not swallow a real customer's order.
  if (typeof body === 'object' && body !== null && 'website' in body) {
    const trap = (body as { website?: unknown }).website
    if (typeof trap === 'string' && trap.trim() !== '') {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    }
  }

  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { customerName, customerPhone, customerEmail, note, items } = parsed.data

  // Merge repeated lines for the same item: two lines of 3 and 4 seats are one
  // line of 7, so the seat-cap check can't be split across lines to slip past it.
  const wanted = new Map<string, number>()
  for (const line of items) {
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity)
  }

  const attempt = async () => {
    const orderRef = generateOrderRef()
    return prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: [...wanted.keys()] }, active: true },
      })
      const byId = new Map(products.map((p) => [p.id, p]))

      // Validate everything BEFORE writing anything, so a bad line rejects the
      // whole order instead of leaving a half-written one behind.
      const lines: { product: (typeof products)[number]; quantity: number }[] = []
      for (const [productId, quantity] of wanted) {
        const product = byId.get(productId)
        if (!product) {
          throw new OrderError('One of the items is no longer available. Please refresh and try again.', 409)
        }
        if (product.price <= 0) {
          throw new OrderError(`${product.name} cannot be ordered online yet — please contact us for pricing.`, 409)
        }
        const cap = product.kind === 'service' ? MAX_SERVICE_QTY : MAX_PRODUCT_QTY
        if (quantity > cap) {
          throw new OrderError(
            product.kind === 'service'
              ? `You can book at most ${MAX_SERVICE_QTY} seats at a time.`
              : `You can order at most ${cap} of ${product.name} at a time.`,
            400
          )
        }
        // Throws CapacityError (409) if this would overbook a workshop.
        await assertSeatsAvailable(tx, product, quantity)
        lines.push({ product, quantity })
      }

      let total = 0
      let donationTotal = 0
      for (const { product, quantity } of lines) {
        const unitPrice = product.price
        const donationAmount = quantity * product.donationPerUnit
        total += quantity * unitPrice
        donationTotal += donationAmount
        await tx.sale.create({
          data: {
            productId: product.id,
            quantity,
            retailer: ONLINE_RETAILER, // server-only sentinel, never client input
            donationAmount,
            unitPrice, // snapshot, so a later price edit doesn't rewrite this order
            status: 'pending', // no money has been received yet
            source: 'online',
            customerName,
            customerPhone,
            customerEmail: customerEmail || null,
            note: note || null,
            orderRef,
          },
        })
        // NOTE: no FundEntry here, and no Pack. A pending order has contributed
        // nothing. The ledger row is written when an admin confirms payment, and
        // (for services) the seat vouchers are minted at the same moment.
      }

      // One message for the whole order, queued in the same transaction as the
      // Sale rows for the same reason the ledger write is: a message must never
      // survive an order that rolled back. Only the receipt LINK is created here
      // — nothing is transmitted. The send happens after the commit, below.
      const queued = await queueMessage(tx, {
        refType: 'order',
        refId: orderRef,
        template: 'order_placed',
        data: { name: customerName, orderRef, total },
        toName: customerName,
        toPhone: customerPhone,
        expiresAt: linkExpiry(),
      })

      return {
        orderRef,
        total,
        donationTotal,
        lines: lines.length,
        // Returned so the confirmation screen can offer the receipt immediately.
        // The customer is the one who just created this order, and the reference
        // is already on screen — showing the link is what makes "keep your
        // reference handy" a promise with a mechanism behind it.
        receiptToken: queued.status === 'no_phone' ? null : queued.token,
      }
    })
  }

  try {
    let result
    try {
      result = await attempt()
    } catch (e) {
      // Two customers booking the last seat at the same instant: SQLite refuses
      // the second writer rather than reporting a clean capacity error. One
      // retry usually lands it on the capacity check, which gives a real answer.
      if (isBusyError(e)) result = await attempt()
      else throw e
    }

    // Tell the customer we have their order. After the commit, so the gateway
    // never holds the order's write lock; outside the transaction, so a gateway
    // failure cannot undo an order that is already real.
    //
    // This endpoint is public and unauthenticated, so auto-sending here really
    // does let a stranger spend the SMS budget: junk orders could burn
    // SMS_DAILY_CAP and leave real customers untexted. That is what the
    // per-IP/global throttles above and the daily cap exist to bound, and it is
    // the same trade the public donations route makes. The alternative — holding
    // the message until an admin acted — protected the budget but broke the only
    // thing this message is for: an acknowledgement of receipt is worthless
    // hours late, and arrived glued to the payment text.
    try {
      await autoDeliver(prisma, 'order', result.orderRef)
    } catch {
      // The order is committed and the customer must see their receipt. A
      // gateway hiccup here must not become a 500 they read as "your order
      // failed" — and would then retry. The message stays queued and the next
      // autoDeliver for this order picks it up.
    }

    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (e) {
    if (e instanceof CapacityError) {
      return NextResponse.json(
        {
          error:
            e.remaining > 0
              ? `Only ${e.remaining} seat(s) left for ${e.productName}. Please reduce your booking.`
              : `${e.productName} is fully booked.`,
          productId: e.productId,
          remainingSeats: e.remaining,
        },
        { status: 409 }
      )
    }
    if (e instanceof OrderError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    if (isBusyError(e)) {
      return NextResponse.json(
        { error: 'We are busy right now. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('[orders] failed', e)
    return NextResponse.json({ error: 'Could not place your order. Please try again.' }, { status: 500 })
  }
}

/** A rejected order with a message meant for the customer. */
class OrderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'OrderError'
  }
}

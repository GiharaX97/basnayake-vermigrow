import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientIp, createThrottle } from '@/lib/throttle'
import {
  PAYMENTS_MIN_CENTS,
  createCheckout,
  paymentsConfig,
  paymentsDemoMode,
} from '@/lib/payments-lk'

/**
 * Start a card payment for an order. PUBLIC — the customer is not logged in.
 *
 * It accepts ONLY `orderRef`. It never accepts an amount, a price or a
 * description from the browser: the expected total is re-read from the pending
 * Sale rows here and sent to the provider in integer LKR cents. That is the one
 * rule the provider's own spec repeats ("take it from your own records, never
 * from the browser"), and it is what makes a tampered form harmless.
 *
 * Double-clicks are safe: an open, unexpired checkout for the order is returned
 * again instead of creating a second one, and the provider call carries the
 * order reference as its Idempotency-Key.
 */

const startThrottle = createThrottle({ windowMs: 10 * 60 * 1000, max: 10 })
const startGlobalThrottle = createThrottle({ windowMs: 60 * 60 * 1000, max: 120 })

/** Refuse bodies that are not tiny — this endpoint takes one short string. */
const MAX_BODY_BYTES = 1024

function publicBase(request: Request): string {
  // The tunnel / reverse proxy is the authority when present: the browser used
  // that host, and Payments.lk needs a URL it can send the customer back to.
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return new URL(request.url).origin
}

function newDemoCheckoutId(): string {
  // Not a real provider id; the prefix makes it obvious in the admin UI.
  return `demo_chk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export async function POST(request: Request) {
  const cfg = paymentsConfig()
  if (!cfg.enabled) {
    console.error(`[payments-start] card payment unavailable: ${cfg.reason}`)
    return NextResponse.json({ error: 'Card payment is not available on this site yet.' }, { status: 503 })
  }

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large' }, { status: 413 })
  }

  const ip = clientIp(request)
  if (startThrottle.check(ip) || startGlobalThrottle.check('global')) {
    return NextResponse.json(
      { error: 'Too many payment attempts from this connection. Please try again in a few minutes.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const orderRef =
    typeof body === 'object' && body !== null && typeof (body as { orderRef?: unknown }).orderRef === 'string'
      ? (body as { orderRef: string }).orderRef.trim()
      : ''
  if (!/^VG-O-[A-Z0-9]{6}$/.test(orderRef)) {
    // Same answer for a bad shape and an unknown order: the reference is not a
    // credential, but there is no reason to help someone enumerate orders either.
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  const lines = await prisma.sale.findMany({
    where: { orderRef },
    select: { id: true, status: true, unitPrice: true, quantity: true, customerName: true, customerEmail: true, customerPhone: true },
  })
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }
  if (lines.some((l) => l.status === 'paid')) {
    return NextResponse.json({ error: 'This order has already been paid.' }, { status: 409 })
  }
  const pending = lines.filter((l) => l.status === 'pending')
  if (pending.length === 0) {
    return NextResponse.json({ error: 'This order was cancelled — it cannot be paid.' }, { status: 409 })
  }

  // Server-derived, never client input. Rounded to whole cents because the
  // provider refuses fractional amounts rather than rounding them itself.
  const total = pending.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const amountCents = Math.round(total * 100)
  if (amountCents < PAYMENTS_MIN_CENTS) {
    return NextResponse.json(
      { error: 'Card payments start at Rs. 10 for this order — please pay in cash or call us.' },
      { status: 409 }
    )
  }

  const base = publicBase(request)
  const successUrl = `${base}/order/complete?ref=${encodeURIComponent(orderRef)}`
  const cancelUrl = `${base}/order?ref=${encodeURIComponent(orderRef)}&cancelled=1`

  const now = new Date()
  const existing = await prisma.paymentIntent.findUnique({ where: { orderRef } })

  // An open checkout that has not expired is handed back as-is. This is what
  // makes a double-clicked "Pay by card" produce one checkout, not two.
  if (
    existing &&
    existing.status === 'open' &&
    existing.checkoutUrl &&
    existing.expiresAt &&
    existing.expiresAt.getTime() > now.getTime() &&
    existing.amountCents === amountCents &&
    existing.mode === cfg.mode
  ) {
    return NextResponse.json({ url: existing.checkoutUrl, reused: true, amountCents })
  }
  if (existing?.status === 'succeeded') {
    return NextResponse.json({ error: 'This order has already been paid.' }, { status: 409 })
  }

  // A previous attempt that ended (failed, expired, provider error) cannot be
  // paid any more, so a retry is a genuinely new checkout. Everything else —
  // including a first attempt — keys on the order reference, so a network retry
  // of THIS request returns the same checkout rather than opening a second one.
  const retry = existing !== null && existing.status !== 'open'
  const idempotencyKey = retry ? `${orderRef}.${Date.now().toString(36)}` : orderRef

  // Reserve the row before calling the provider, so two requests racing cannot
  // both create a checkout. SQLite's single writer plus this upsert is enough.
  try {
    if (existing) {
      await prisma.paymentIntent.update({
        where: { orderRef },
        data: {
          checkoutId: null,
          paymentId: null,
          mode: cfg.mode ?? 'test',
          amountCents,
          status: 'open',
          checkoutUrl: null,
          expiresAt: null,
          failureMessage: null,
          feeCents: null,
          netCents: null,
          cardScheme: null,
          cardLast4: null,
        },
      })
    } else {
      await prisma.paymentIntent.create({
        data: {
          orderRef,
          mode: cfg.mode ?? 'test',
          amountCents,
          status: 'open',
        },
      })
    }
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A payment is already being started for this order. Please try again.' }, { status: 409 })
    }
    throw err
  }

  if (paymentsDemoMode()) {
    const checkoutId = newDemoCheckoutId()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
    const url = `${base}/order/demo-pay?ref=${encodeURIComponent(orderRef)}`
    await prisma.paymentIntent.update({
      where: { orderRef },
      data: { checkoutId, checkoutUrl: url, expiresAt, mode: 'test' },
    })
    return NextResponse.json({ url, demo: true, amountCents })
  }

  try {
    const checkout = await createCheckout({
      amountCents,
      description: `Order ${orderRef}`,
      reference: orderRef,
      successUrl,
      cancelUrl,
      customer: {
        name: pending[0].customerName ?? 'Customer',
        email: pending[0].customerEmail,
        phone: pending[0].customerPhone,
      },
      idempotencyKey,
    })

    await prisma.paymentIntent.update({
      where: { orderRef },
      data: {
        checkoutId: checkout.checkoutId,
        paymentId: checkout.paymentId,
        mode: checkout.mode ?? cfg.mode ?? 'test',
        status: 'open',
        checkoutUrl: checkout.url,
        expiresAt: checkout.expiresAt ? new Date(checkout.expiresAt) : null,
        failureMessage: null,
      },
    })

    return NextResponse.json({ url: checkout.url, amountCents })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start the card payment.'
    await prisma.paymentIntent
      .update({
        where: { orderRef },
        data: { status: 'error', failureMessage: message.slice(0, 500) },
      })
      .catch(() => undefined)
    console.error('[payments-start] provider call failed', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/** POST only. Answered for a misconfigured dashboard instead of a blank 405. */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed — start a card payment with POST { orderRef }.' },
    { status: 405 }
  )
}

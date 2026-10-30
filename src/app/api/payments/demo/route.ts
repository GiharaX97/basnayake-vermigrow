import { NextResponse } from 'next/server'
import { createHmac, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { clientIp, createThrottle } from '@/lib/throttle'
import { paymentsConfig, paymentsDemoMode } from '@/lib/payments-lk'

/**
 * DEMO ONLY: stand in for the customer paying on Payments.lk's hosted page.
 *
 * This exists so the whole flow — order → card → signed webhook → settled →
 * revenue in the fund → SMS — can be demonstrated on a machine with no provider
 * keys. It does NOT bypass the real path: it signs a realistic
 * `payment.succeeded` / `payment.failed` event with the configured webhook
 * secret and POSTs it to our own `/api/payments/webhook`, which then verifies the
 * HMAC exactly as it would for Payments.lk and settles through `settleOrderTx`.
 *
 * Refuses unless `PAYMENTS_LK_DEMO=1` AND no real secret key is configured, so it
 * can never shadow a live account. If real keys are added, this route disappears
 * from the flow by config alone.
 */

const demoThrottle = createThrottle({ windowMs: 5 * 60 * 1000, max: 20 })

function publicBase(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  if (!paymentsDemoMode()) {
    return NextResponse.json({ error: 'Demo payments are not enabled.' }, { status: 404 })
  }
  const cfg = paymentsConfig()
  if (!cfg.webhookSecret) {
    return NextResponse.json({ error: 'No webhook secret is configured.' }, { status: 503 })
  }
  if (demoThrottle.check(clientIp(request))) {
    return NextResponse.json({ error: 'Too many demo payments — wait a moment.' }, { status: 429 })
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
  const outcome =
    typeof body === 'object' && body !== null && (body as { outcome?: unknown }).outcome === 'failed'
      ? 'failed'
      : 'succeeded'

  const intent = await prisma.paymentIntent.findUnique({ where: { orderRef } })
  if (!intent || !intent.checkoutId) {
    return NextResponse.json({ error: 'Order not found — start the card payment first.' }, { status: 404 })
  }
  if (intent.status === 'succeeded') {
    return NextResponse.json({ error: 'This order has already been paid.' }, { status: 409 })
  }

  const paymentId = `pay_demo_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  // A realistic-looking fee, so the admin's reconciliation column shows real
  // numbers during the demo. 2.5% is a placeholder, not a quoted rate.
  const feeCents = outcome === 'succeeded' ? Math.round(intent.amountCents * 0.025) : null

  const event = {
    id: `evt_demo_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    object: 'event',
    type: outcome === 'succeeded' ? 'payment.succeeded' : 'payment.failed',
    mode: intent.mode,
    created: new Date().toISOString(),
    data: {
      object: 'payment',
      id: paymentId,
      mode: intent.mode,
      status: outcome === 'succeeded' ? 'succeeded' : 'failed',
      amountCents: intent.amountCents,
      currency: 'LKR',
      description: `Order ${orderRef}`,
      reference: orderRef,
      customer: null,
      card: outcome === 'succeeded' ? { scheme: 'VISA', last4: '4242' } : null,
      cardSave: 'not_requested',
      feeCents,
      netCents: feeCents === null ? null : intent.amountCents - feeCents,
      refundedCents: 0,
      failureMessage: outcome === 'succeeded' ? null : 'The test card was declined.',
      checkoutId: intent.checkoutId,
      createdAt: new Date().toISOString(),
      succeededAt: outcome === 'succeeded' ? new Date().toISOString() : null,
    },
  }
  const raw = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', cfg.webhookSecret).update(`${t}.${raw}`).digest('hex')

  const webhookUrl = `${publicBase(request)}/api/payments/webhook`
  let webhookStatus = 0
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Payments-Signature': `t=${t},v1=${v1}`,
        'Payments-Event-Id': event.id,
      },
      body: raw,
      signal: AbortSignal.timeout(15_000),
    })
    webhookStatus = res.status
  } catch (err) {
    console.error('[payments-demo] could not deliver the signed event', err)
    return NextResponse.json(
      { error: 'The demo event could not be delivered to the webhook.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: webhookStatus >= 200 && webhookStatus < 300, orderRef, outcome, webhookStatus })
}

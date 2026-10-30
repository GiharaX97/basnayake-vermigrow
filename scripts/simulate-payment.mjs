#!/usr/bin/env node
/**
 * Pretend Payments.lk sent a webhook.
 *
 * Builds the exact event shape the provider posts, signs it
 * (`Payments-Signature: t=<unix>,v1=hex HMAC-SHA256("<t>.<rawBody>")`), and
 * delivers it to /api/payments/webhook. This is how the card flow is exercised
 * without a provider account, a card, or a public tunnel.
 *
 *   node scripts/simulate-payment.mjs VG-O-ABC234
 *   node scripts/simulate-payment.mjs VG-O-ABC234 --outcome failed
 *   node scripts/simulate-payment.mjs VG-O-ABC234 --outcome expired
 *   node scripts/simulate-payment.mjs VG-O-ABC234 --amount 1 --bad-signature
 *
 * It reads the PaymentIntent for the order from the SAME database the app uses,
 * so amount, mode and checkout id match a real checkout. Flags let a test prove
 * the refusals: a tampered amount, a wrong mode, a bad signature, a replay.
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')

function fromEnvFile(key) {
  if (process.env[key]) return process.env[key]
  try {
    const text = readFileSync(join(process.cwd(), '.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
      if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env — fall through */
  }
  return ''
}

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  if (i === -1) return fallback
  const value = args[i + 1]
  args.splice(i, 2)
  return value
}
const bool = (name) => {
  const i = args.indexOf(name)
  if (i === -1) return false
  args.splice(i, 1)
  return true
}

const orderRef = args.find((a) => !a.startsWith('--'))
const outcome = flag('--outcome', 'succeeded')
const amountOverride = flag('--amount', null)
const modeOverride = flag('--mode', null)
const secretOverride = flag('--secret', null)
const badSignature = bool('--bad-signature')
const replay = bool('--replay')
const eventIdOverride = flag('--event-id', null)

function die(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

if (!orderRef) die('Usage: node scripts/simulate-payment.mjs <orderRef> [--outcome succeeded|failed|expired]')
if (!['succeeded', 'failed', 'expired'].includes(outcome)) die(`Unknown outcome ${outcome}`)
if (orderRef.startsWith('VG-O-') === false) die(`Order refs look like VG-O-ABC234; got ${orderRef}`)

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

const intent = await prisma.paymentIntent.findUnique({ where: { orderRef } })
if (!intent) die(`No PaymentIntent for ${orderRef}. Start a card payment first.`)

const secret = secretOverride || fromEnvFile('PAYMENTS_LK_WEBHOOK_SECRET')
if (!secret) die('PAYMENTS_LK_WEBHOOK_SECRET is not set in the environment or .env')

const mode = modeOverride || intent.mode
const amountCents = amountOverride !== null ? Number(amountOverride) : intent.amountCents
const paymentId = `pay_sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
let eventId =
  eventIdOverride ||
  `evt_sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

let event
if (outcome === 'expired') {
  event = {
    id: eventId,
    object: 'event',
    type: 'checkout.expired',
    mode,
    created: new Date().toISOString(),
    data: { object: 'checkout', id: intent.checkoutId, paymentId },
  }
} else {
  event = {
    id: eventId,
    object: 'event',
    type: outcome === 'succeeded' ? 'payment.succeeded' : 'payment.failed',
    mode,
    created: new Date().toISOString(),
    data: {
      object: 'payment',
      id: paymentId,
      mode,
      status: outcome === 'succeeded' ? 'succeeded' : 'failed',
      amountCents,
      currency: 'LKR',
      description: `Order ${orderRef}`,
      reference: orderRef,
      customer: null,
      card: outcome === 'succeeded' ? { scheme: 'VISA', last4: '4242' } : null,
      cardSave: 'not_requested',
      feeCents: outcome === 'succeeded' ? Math.round(amountCents * 0.025) : null,
      netCents: outcome === 'succeeded' ? amountCents - Math.round(amountCents * 0.025) : null,
      refundedCents: 0,
      failureMessage: outcome === 'failed' ? 'The test card was declined.' : null,
      checkoutId: intent.checkoutId,
      createdAt: new Date().toISOString(),
      succeededAt: outcome === 'succeeded' ? new Date().toISOString() : null,
    },
  }
}

// A replay sends the SAME event id again — the dedupe case.
if (replay) {
  const previous = await prisma.paymentWebhookEvent.findFirst({
    where: { orderRef },
    orderBy: { createdAt: 'desc' },
  })
  if (!previous) die('No earlier webhook event for this order to replay.')
  eventId = previous.eventId
  event.id = eventId
}

const raw = JSON.stringify(event)
const t = Math.floor(Date.now() / 1000)
const signature = badSignature
  ? '0'.repeat(64)
  : createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')

const res = await fetch(`${BASE}/api/payments/webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Payments-Signature': `t=${t},v1=${signature}`,
    'Payments-Event-Id': eventId,
  },
  body: raw,
})

const text = await res.text()
console.log(`\n→ POST ${BASE}/api/payments/webhook`)
console.log(`  outcome : ${outcome}${badSignature ? ' (bad signature)' : ''}${replay ? ' (replay)' : ''}`)
console.log(`  order   : ${orderRef}   mode: ${mode}   amountCents: ${amountCents}`)
console.log(`  HTTP ${res.status} ${text}\n`)

await prisma.$disconnect()
process.exitCode = res.ok ? 0 : 1

#!/usr/bin/env node
/**
 * Pretend a customer texted us.
 *
 * Builds the exact CloudEvents payload httpSMS posts, signs it with the webhook
 * secret the same way, and sends it to /api/sms/webhook. This is how the
 * CONFIRM / CANCEL loop gets exercised without a gateway account, a handset, or
 * a public tunnel — none of which can be borrowed at will.
 *
 *   node scripts/simulate-reply.mjs CONFIRM
 *   node scripts/simulate-reply.mjs CANCEL
 *   node scripts/simulate-reply.mjs "cancel my order please"
 *   node scripts/simulate-reply.mjs CONFIRM --phone +94771234567
 *   node scripts/simulate-reply.mjs --receipt delivered <providerMessageId>
 *
 * A real handset still goes through the same route with the same signature, so
 * what this proves about the policy holds for the real thing. What it cannot
 * prove is that httpSMS sends the payload we think it does — only the tunnel
 * and a real phone can settle that.
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
const SENDER = '+94773259724'

/**
 * Read one key from .env if it is not already in the environment.
 *
 * Node does not load .env the way `next dev` does, and requiring the user to
 * export a secret before every invocation is how a tool stops being used. Only
 * reached when the variable is unset, so a real environment always wins.
 */
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

const SECRET = fromEnvFile('HTTPSMS_WEBHOOK_SECRET')

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  if (i === -1) return fallback
  const value = args[i + 1]
  args.splice(i, 2)
  return value
}

const phone = flag('--phone', SENDER)
const receiptType = flag('--receipt', null)
const secretOverride = flag('--secret', null)

function die(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const b64url = (s) => Buffer.from(s).toString('base64url')

function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300, ...payload })
  )
  const sig = createHmac('sha256', secretOverride ?? SECRET).update(`${header}.${claims}`).digest('base64url')
  return `${header}.${claims}.${sig}`
}

async function post(body) {
  const res = await fetch(`${BASE}/api/sms/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${signJwt(body)}`,
      'x-event-type': body.type,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text }
}

async function main() {
  if (!SECRET && !secretOverride) {
    die(
      'HTTPSMS_WEBHOOK_SECRET is not set in the environment or .env.\n' +
        '  The webhook answers 503 to everything without it, by design.'
    )
  }

  try {
    await fetch(`${BASE}/api/catalog`)
  } catch {
    die(`Nothing is answering on ${BASE}. Start the dev server first: npm run dev`)
  }

  let type
  let data
  let body

  if (receiptType) {
    const providerMessageId = args[0]
    if (!providerMessageId) die('--receipt needs the gateway message id, e.g. mock-<uuid>')
    type = `message.phone.${receiptType}`
    // sent/delivered/failed name the id `id`; expired names it `message_id`.
    data = receiptType === 'expired' ? { message_id: providerMessageId } : { id: providerMessageId }
    body = { type, id: `sim-${Date.now()}`, data }
  } else {
    const content = args.join(' ').trim()
    if (!content) die('Nothing to send. Try: node scripts/simulate-reply.mjs CONFIRM')
    type = 'message.phone.received'
    // `message_id`, not `id` — httpSMS names this field differently per event.
    // Getting it wrong here would send a payload the real gateway never sends and
    // prove nothing, and would also leave the event with no idempotency key.
    data = { message_id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, content, contact: phone, owner: '+94770000000' }
    body = { type, id: data.message_id, data }
  }

  const { status, json, text } = await post(body)

  const label = receiptType ? `${type}` : `"${data.content}" from ${phone}`
  if (status === 200) {
    console.log(`\n✓ ${label} → 200 ${json ? JSON.stringify(json) : text}`)
    if (!receiptType) {
      console.log(`
Next: see what it did to the order.
  ${BASE}/admin/orders                    — the order's stage, and any cancel-request flag
  ${BASE}/admin/donations → Messages tab  — every reply, including the ones that matched nothing
  ${BASE}/admin/orders/<ref>              — the timeline, which names the actor for each move
`)
    }
  } else {
    console.error(`\n✗ ${label} → ${status} ${json ? JSON.stringify(json) : text}`)
    if (status === 401) console.error('  Signature rejected: the server is using a different secret than this script.')
    if (status === 503) console.error('  Server has no webhook secret configured.')
    process.exit(1)
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)))

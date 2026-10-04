/**
 * End-to-end test of AUTOMATIC SMS — the path the main suite deliberately never
 * exercises, because the main suite runs with no gateway configured.
 *
 *   node scripts/e2e-sms.mjs <phase>
 *
 * Run it through scripts/run-e2e-sms.sh, which starts a fresh server per phase
 * with the right environment. Phases:
 *
 *   mock    SMS_PROVIDER=mock, SMS_DAILY_CAP=3. A sale texts the customer; an
 *           online order does NOT (no money has moved yet); settling it sends
 *           both messages; the 4th automatic send is refused by the cap and the
 *           admin's "Send all queued" clears it anyway.
 *   fail    SMS_MOCK_FAIL=1. The gateway refuses everything — and the sale must
 *           still be recorded, banked and counted. This is the property that
 *           matters most: an SMS outage is not a reason to lose a sale.
 *   manual  No gateway. Nothing transmits, the transport reports 'manual', and
 *           the bulk-send endpoint refuses rather than marking the whole queue
 *           sent without sending it.
 *
 * Env: E2E_BASE, DATABASE_URL (must be the copy), SMS_MOCK_LOG.
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3001'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin123'
const DB_URL = process.env.DATABASE_URL ?? ''
const LOG = process.env.SMS_MOCK_LOG ?? ''
const PHASE = process.argv[2] ?? 'mock'

const prisma = new PrismaClient()

/* ----------------------------------------------------------- tiny harness -- */

let passed = 0
let failed = 0
const failures = []

function check(name, cond, detail) {
  if (cond) {
    passed++
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } else {
    failed++
    const line = `${PHASE} › ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`
    failures.push(line)
    console.log(`  \x1b[31m✗ ${name}\x1b[0m${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`)
  }
  return !!cond
}

function eq(name, actual, expected) {
  return check(name, actual === expected, actual === expected ? undefined : { actual, expected })
}

class GuardFailed extends Error {}
function must(name, cond, detail) {
  if (!check(name, cond, detail)) throw new GuardFailed(name)
  return true
}

/* ------------------------------------------------------------------ http -- */

const jar = {}
let ipCounter = 0
const nextIp = () => `10.77.${Math.floor(ipCounter / 250)}.${++ipCounter % 250}`

function absorbCookies(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(';')[0]
    const i = pair.indexOf('=')
    const k = pair.slice(0, i).trim()
    const v = pair.slice(i + 1).trim()
    if (v === '') delete jar[k]
    else jar[k] = v
  }
}

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

async function req(method, path, { body, cookie, ip } = {}) {
  const h = { 'x-forwarded-for': ip ?? nextIp() }
  const c = cookie !== undefined ? cookie : cookieHeader()
  if (c) h.cookie = c
  let payload
  if (body !== undefined) {
    payload = JSON.stringify(body)
    h['content-type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: payload, redirect: 'manual' })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* html / empty */
  }
  absorbCookies(res)
  return { status: res.status, headers: res.headers, text, json }
}

const get = (p, o) => req('GET', p, o)
const post = (p, body, o) => req('POST', p, { ...o, body })

/* --------------------------------------------------------------- helpers -- */

const PRODUCT_NAME = 'E2E SMS Vermicompost'
const RETAILER = 'E2E SMS Counter'
const BUYER = 'E2E SMS Buyer'
const PHONE = '0771234567'
const E164 = '+94771234567'
const PRICE = 250
const DONATION_PER_UNIT = 30

const logLines = () => (LOG && existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : [])

async function linkFor(refType, refId) {
  return prisma.customerLink.findUnique({
    where: { refType_refId: { refType, refId } },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
}

/** Delete everything a previous phase of this script created, FK-safe order. */
async function cleanup() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: 'E2E SMS ' } },
    select: { id: true },
  })
  const pids = products.map((p) => p.id)
  const sales = pids.length
    ? await prisma.sale.findMany({ where: { productId: { in: pids } }, select: { id: true, orderRef: true } })
    : []
  const sids = sales.map((s) => s.id)
  const refs = sales.map((s) => s.orderRef).filter(Boolean)
  const links = await prisma.customerLink.findMany({
    where: {
      OR: [
        { refType: 'sale', refId: { in: sids } },
        { refType: 'order', refId: { in: refs } },
      ],
    },
    select: { id: true },
  })
  const linkIds = links.map((l) => l.id)

  await prisma.customerMessage.deleteMany({ where: { linkId: { in: linkIds } } })
  await prisma.customerLink.deleteMany({ where: { id: { in: linkIds } } })
  await prisma.fundEntry.deleteMany({ where: { channel: 'sale', refId: { in: sids } } })
  await prisma.payment.deleteMany({ where: { OR: [{ saleId: { in: sids } }, { orderRef: { in: refs } }] } })
  await prisma.pack.deleteMany({ where: { productId: { in: pids } } })
  await prisma.sale.deleteMany({ where: { id: { in: sids } } })
  await prisma.product.deleteMany({ where: { id: { in: pids } } })
}

/**
 * Make today look untouched, so the daily-cap assertions mean what they say.
 *
 * `autoSentToday` counts every automatic send since local midnight across the
 * WHOLE database, and every phase runs against a fresh copy of the working DB —
 * one the farm has actually used, so it already has sends in it. Without this,
 * the cap (`SMS_DAILY_CAP=3` in the mock phase) is spent before the first
 * assertion, every automatic send is held back, and the phase fails in a way
 * that is indistinguishable from broken auto-send code.
 *
 * The rows are pushed back a day rather than deleted: they are the working DB's,
 * not this suite's to destroy, and nothing reads `sentAt` except this counter.
 * Only `sentBy: 'auto'` moves, because that is the only thing the cap counts.
 */
async function resetDailyAutoSendCounter() {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const today = await prisma.customerMessage.count({
    where: { sentBy: 'auto', sentAt: { gte: midnight } },
  })
  if (today === 0) return
  console.log(`  \x1b[2m(i) ${today} automatic send(s) already today — moved back a day for this phase\x1b[0m`)
  await prisma.customerMessage.updateMany({
    where: { sentBy: 'auto', sentAt: { gte: midnight } },
    data: { sentAt: new Date(midnight.getTime() - 24 * 60 * 60 * 1000) },
  })
}

async function setup() {
  await cleanup()
  await resetDailyAutoSendCounter()
  const login = await post('/api/auth/login', { password: PASSWORD }, { cookie: '' })
  must('admin login → 200', login.status === 200, { status: login.status, body: login.json })

  const created = await post('/api/admin/products', {
    name: PRODUCT_NAME,
    kind: 'product',
    price: PRICE,
    unit: 'per pack',
    description: 'sms e2e product',
    donationPerUnit: DONATION_PER_UNIT,
  })
  must('create a product → 201', created.status === 201, { status: created.status, body: created.json })
  return created.json
}

/** Record a counter sale through the admin API and return the new Sale row. */
async function counterSale(product, qty = 1) {
  const res = await post('/api/admin/sales', {
    productId: product.id,
    quantity: qty,
    retailer: RETAILER,
    customerName: BUYER,
    customerPhone: PHONE,
  })
  must('record a counter sale → 201', res.status === 201, { status: res.status, body: res.json })
  return res.json
}

/* ----------------------------------------------------- inbound webhooks -- */

/**
 * Signing a JWT by hand, exactly as httpSMS does. Deliberately not using the
 * app's own helper: a test that verifies the verifier with the verifier's own
 * code proves nothing. This is the independent second implementation.
 */
const WEBHOOK_SECRET = process.env.HTTPSMS_WEBHOOK_SECRET ?? ''
const E2E_SENDER = '+94770000000'

const b64url = (s) => Buffer.from(s).toString('base64url')

function signJwt(payload, secret = WEBHOOK_SECRET) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300, ...payload }))
  const sig = createHmac('sha256', secret).update(`${header}.${claims}`).digest('base64url')
  return `${header}.${claims}.${sig}`
}

async function postWebhook(body, { authorization, eventType } = {}) {
  const headers = { 'content-type': 'application/json', 'x-forwarded-for': nextIp() }
  if (authorization !== undefined) headers.authorization = authorization
  if (eventType) headers['x-event-type'] = eventType
  const res = await fetch(`${BASE}/api/sms/webhook`, {
    method: 'POST',
    headers,
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

/** A signed event in the CloudEvents envelope httpSMS posts. */
const event = (type, data, id) =>
  postWebhook({ type, id, data }, { authorization: `Bearer ${signJwt({ type, id, data })}` })

/**
 * A customer's text arriving. `id` is that message's own id, and must be unique.
 *
 * The field is `message_id`, NOT `id` — httpSMS names it differently per event
 * (message_id for received/expired/missed, id for sent/delivered/failed). Using
 * the wrong one here would have made the test pass against a payload shape the
 * real gateway never sends.
 */
const reply = (content, contact, id) =>
  event('message.phone.received', { message_id: id, content, contact, owner: E2E_SENDER }, id)

/** The phone reporting what became of a message we sent (sent/delivered: `id`). */
const receipt = (type, providerMessageId, id) => event(type, { id: providerMessageId }, id)

/**
 * A receipt for a send whose response never reached us. We never learned the
 * gateway's id for that message, so the event is matched by the `request_id` we
 * sent out — the whole reason that field is set on every outbound message.
 */
const receiptByRequestId = (type, requestId, id) => event(type, { request_id: requestId }, id)

/** Every line of an order, as the DB has it. The order IS its rows. */
const orderLines = (orderRef) =>
  prisma.sale.findMany({
    where: { orderRef },
    select: { status: true, fulfillment: true, cancelRequestedAt: true },
    orderBy: { createdAt: 'asc' },
  })

const messageOn = (linkId, template) =>
  prisma.customerMessage.findFirst({ where: { linkId, template } })

/* -------------------------------------------------------------- the phases -- */

/**
 * The whole point of the feature: a recorded sale texts the buyer what their
 * purchase gave to the fund — and the money is banked whether or not the text
 * gets out.
 */
async function phaseMock() {
  const product = await setup()
  if (LOG) writeFileSync(LOG, '')

  const list = await get('/api/admin/messages')
  eq('GET /api/admin/messages → 200', list.status, 200)
  eq('transport is http (a gateway is configured)', list.json?.transport, 'http')
  eq('   provider reports mock', list.json?.provider?.provider, 'mock')
  eq('   mock needs no credentials, so it is ready', list.json?.provider?.ready, true)
  eq('   automatic sending is on', list.json?.autoSend?.enabled, true)
  eq('   cap comes from SMS_DAILY_CAP', list.json?.autoSend?.cap, 3)
  eq('   nothing sent automatically yet', list.json?.autoSend?.sentToday, 0)

  /* ---- 1. a counter sale sends immediately ---- */
  const sale = await counterSale(product)
  const link = await linkFor('sale', sale.id)
  must('DB: message row exists for the sale', link?.messages?.length === 1, { n: link?.messages?.length })
  const msg = link.messages[0]
  eq('   template sale_thanks', msg.template, 'sale_thanks')
  eq('   SENT, with no human involved', msg.status, 'sent')
  eq('   attributed to the machine', msg.sentBy, 'auto')
  check('   sentAt recorded', !!msg.sentAt)
  check('   no error', !msg.error)
  check('   the body states the donation', /LKR\s*30/.test(msg.body), { body: msg.body })
  check('   the body states the purchase total', /LKR\s*250/.test(msg.body), { body: msg.body })
  check('   the body carries a receipt link', /\/r\//.test(msg.body))

  const lines = logLines()
  must('the mock gateway received the message', lines.length === 1, { lines })
  // 0771234567 as the form collected it must come out as E.164 at the gateway.
  check('   normalised to E.164', lines[0].includes(`to=${E164}`), { line: lines[0] })
  check('   carrying the same body', lines[0].includes(msg.body.slice(0, 40)), { line: lines[0] })

  const afterSale = await get('/api/admin/messages')
  eq('   sentToday is now 1', afterSale.json?.autoSend?.sentToday, 1)

  /* ---- 2. placing an online order acknowledges it straight away ---- */
  const order = await post('/api/orders', {
    customerName: BUYER,
    customerPhone: PHONE,
    customerEmail: 'sms-e2e@example.com',
    items: [{ productId: product.id, quantity: 2 }],
  })
  must('place an online order → 201', order.status === 201, { status: order.status, body: order.json })
  const orderRef = order.json.orderRef

  const orderLink = await linkFor('order', orderRef)
  must('DB: order message queued', orderLink?.messages?.length === 1, { n: orderLink?.messages?.length })
  eq('   order_placed', orderLink.messages[0].template, 'order_placed')
  // This endpoint is public and unauthenticated, so this is the one automatic
  // send a stranger can trigger directly. It is bounded by SMS_DAILY_CAP and the
  // order throttle on the route rather than held for an admin: the message is an
  // acknowledgement of receipt, and one that arrives hours later — glued to the
  // payment text — is not worth sending at all.
  eq('   SENT at creation — acknowledged now, not held', orderLink.messages[0].status, 'sent')
  eq('   attributed to the machine', orderLink.messages[0].sentBy, 'auto')
  const afterOrder = await get('/api/admin/messages')
  eq('   the order spent one automatic send', afterOrder.json?.autoSend?.sentToday, 2)

  /* ---- 3. settling it sends both messages, oldest first ---- */
  const settled = await post(`/api/admin/orders/${orderRef}/settle`, { action: 'pay', method: 'cash' })
  must('settle the order → 200', settled.status === 200, { status: settled.status, body: settled.json })
  eq('   donation total reported by the API', settled.json?.donationTotal, DONATION_PER_UNIT * 2)

  const drain = await linkFor('order', orderRef)
  eq('DB: 2 messages on the order link', drain.messages.length, 2)
  eq('   both sent', drain.messages.every((m) => m.status === 'sent'), true)
  const placedMsg = drain.messages.find((m) => m.template === 'order_placed')
  const paidMsg = drain.messages.find((m) => m.template === 'order_paid')
  check('   order_placed went out too — it carries the reference', !!placedMsg.sentAt)
  check('   order_paid names the donation', /LKR\s*60/.test(paidMsg.body), { body: paidMsg.body })
  check('   the order total is stated', /LKR\s*500/.test(paidMsg.body), { body: paidMsg.body })
  check(
    '   order_paid leaks no reference and no pass code',
    !paidMsg.body.includes(orderRef) && !/VG-/.test(paidMsg.body),
    { body: paidMsg.body }
  )
  eq('   the gateway got all three', logLines().length, 3)

  const atCap = await get('/api/admin/messages')
  eq('   sentToday has reached the cap of 3', atCap.json?.autoSend?.sentToday, 3)

  /* ---- 4. the cap holds the next one back ---- */
  const held = await counterSale(product)
  const heldLink = await linkFor('sale', held.id)
  eq('DB: the 4th message stays queued', heldLink.messages[0].status, 'queued')
  check('   and was not handed to the gateway', logLines().length === 3)
  const heldMsg = heldLink.messages[0]
  eq(
    'DB: the sale itself is still banked',
    await prisma.sale.findUnique({ where: { id: held.id } }).then((s) => s.status),
    'paid'
  )
  eq(
    '   the sale is still in the fund ledger',
    await prisma.fundEntry.count({ where: { channel: 'sale', refId: held.id } }),
    1
  )

  /* ---- 5. a human can still send what the cap held ---- */
  const bulk = await post('/api/admin/messages')
  eq('POST /api/admin/messages → 200', bulk.status, 200)
  eq('   1 message sent', bulk.json?.sent, 1)
  eq('   0 failed', bulk.json?.failed, 0)
  eq('   nothing left queued', bulk.json?.remaining, 0)

  const afterBulk = await prisma.customerMessage.findUnique({ where: { id: heldMsg.id } })
  eq('   the held message is now sent', afterBulk.status, 'sent')
  // A hand-triggered send is NOT charged to the automatic budget, or one busy
  // morning would lock the automation out for the rest of the day.
  eq('   attributed to the admin', afterBulk.sentBy, 'admin')
  const afterBulk2 = await get('/api/admin/messages')
  eq('   sentToday still 3 — the cap counts automatic sends only', afterBulk2.json?.autoSend?.sentToday, 3)
  eq('   the gateway got a 4th', logLines().length, 4)
}

/**
 * The property that matters most: the gateway refusing everything must not cost
 * the farm a sale, a payment record, or a fund entry.
 */
async function phaseFail() {
  const product = await setup()
  const totalBefore = (await get('/api/donations', { cookie: '' })).json?.total ?? 0

  const sale = await counterSale(product)

  eq(
    'DB: the sale is recorded and paid',
    await prisma.sale.findUnique({ where: { id: sale.id } }).then((s) => s.status),
    'paid'
  )
  eq(
    '   its contribution reached the fund ledger',
    await prisma.fundEntry.count({ where: { channel: 'sale', refId: sale.id, status: 'paid' } }),
    1
  )
  const totalAfter = (await get('/api/donations', { cookie: '' })).json?.total ?? 0
  eq('   the public fund total went up by the donation', totalAfter - totalBefore, DONATION_PER_UNIT)

  const link = await linkFor('sale', sale.id)
  must('DB: message row exists', link?.messages?.length === 1, { n: link?.messages?.length })
  const msg = link.messages[0]
  eq('   marked failed, not sent', msg.status, 'failed')
  check('   the provider error is recorded for the admin', /mock provider/.test(msg.error ?? ''), {
    error: msg.error,
  })
  // A failed row must not claim to have been sent. The claim-first design stamps
  // sentAt optimistically, so this is the assertion that catches it not being
  // cleared — otherwise the admin list reads "Sent 14:02" over a message nobody got.
  check('   no sentAt — nothing was sent', !msg.sentAt)
  eq('   and no sentBy either', msg.sentBy, null)

  // Still in the queue's reach: a failed message must be recoverable, not lost.
  const list = await get('/api/admin/messages')
  eq('   the failed count surfaces it', list.json?.failedCount >= 1, true)
  eq('   and it is NOT counted as an automatic send', list.json?.autoSend?.sentToday, 0)
}

/**
 * No gateway: today's behaviour, unchanged. Nothing transmits, and the bulk
 * endpoint refuses rather than writing status='sent' for messages nobody got.
 */
async function phaseManual() {
  const product = await setup()

  const list = await get('/api/admin/messages')
  eq('transport is manual (no gateway)', list.json?.transport, 'manual')
  eq('   provider reports manual', list.json?.provider?.provider, 'manual')
  eq('   and is not ready', list.json?.provider?.ready, false)
  eq('   no credentials reported missing (none are needed)', list.json?.provider?.missing?.length, 0)

  const sale = await counterSale(product)
  const link = await linkFor('sale', sale.id)
  must('DB: message queued', link?.messages?.length === 1, { n: link?.messages?.length })
  eq('   status queued — nothing sends itself', link.messages[0].status, 'queued')
  eq('   sentBy is null', link.messages[0].sentBy, null)

  const bulk = await post('/api/admin/messages')
  eq('POST /api/admin/messages with no gateway → 400', bulk.status, 400)
  check('   the refusal explains why', /gateway/i.test(bulk.json?.error ?? ''), { error: bulk.json?.error })

  // And the refusal really refused: the row must still be untouched.
  const after = await prisma.customerMessage.findUnique({ where: { id: link.messages[0].id } })
  eq('   the queued message is STILL queued', after.status, 'queued')
}

/* ------------------------------------------------------- inbound webhooks -- */

/**
 * The httpSMS callback: delivery receipts, and customers texting back.
 *
 * This is the only public, unauthenticated endpoint in the app, so the tests
 * start with the gate — everything else is worthless if a stranger can post to
 * it. After that they walk the policy table: a receipt changes only delivery
 * columns, CONFIRM moves a paid order, and CANCEL refuses to touch a paid one.
 *
 * `SMS_MOCK_FAIL=0` matters here: the mock's predictable `mock-<id>` send id is
 * what a receipt is matched against, so the send must actually succeed.
 */
async function phaseWebhook() {
  const product = await setup()

  /* ---- 1. the signature is the whole gate ---- */
  // Counted as a delta, not against zero: the DB is a copy of the working one,
  // which may already hold real webhook events. "Nothing was written" is the
  // claim being tested, and it is just as true against a non-empty table.
  const eventsBefore = await prisma.smsEvent.count()

  const unsigned = await postWebhook({ type: 'message.phone.delivered', id: 'e0', data: { id: 'x' } })
  eq('an unsigned event → 401', unsigned.status, 401)

  const malformed = await postWebhook(
    { type: 'message.phone.delivered', id: 'e0', data: { id: 'x' } },
    { authorization: 'Bearer not-a-jwt' }
  )
  eq('a malformed token → 401', malformed.status, 401)

  const wrongKey = await postWebhook(
    { type: 'message.phone.delivered', id: 'e0', data: { id: 'x' } },
    { authorization: `Bearer ${signJwt({ type: 'message.phone.delivered' }, 'not-the-key')}` }
  )
  eq('a token signed with the wrong key → 401', wrongKey.status, 401)

  // `alg: none` is the classic bypass: a token with no signature at all must be
  // rejected rather than treated as "already verified".
  const head = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300 }))
  const noneAlg = await postWebhook(
    { type: 'message.phone.delivered', id: 'e0', data: { id: 'x' } },
    { authorization: `Bearer ${head}.${claim}.` }
  )
  eq('an alg=none token → 401', noneAlg.status, 401)

  const expired = await postWebhook(
    { type: 'message.phone.delivered', id: 'e0', data: { id: 'x' } },
    {
      authorization: `Bearer ${signJwt({
        type: 'message.phone.delivered',
        exp: Math.floor(Date.now() / 1000) - 3600,
      })}`,
    }
  )
  eq('an expired token → 401', expired.status, 401)

  eq('   none of that wrote anything', await prisma.smsEvent.count(), eventsBefore)

  /* ---- 2. an order to talk about ---- */
  const placed = await post('/api/orders', {
    customerName: BUYER,
    customerPhone: PHONE,
    customerEmail: 'sms-webhook@example.com',
    items: [{ productId: product.id, quantity: 1 }],
  })
  must('place an online order → 201', placed.status === 201, {
    status: placed.status,
    body: placed.json,
  })
  const orderRef = placed.json.orderRef

  /* ---- 3. CONFIRM on an UNPAID order is recorded, not obeyed ---- */
  const tooEarly = await reply('CONFIRM', E164, 'in-early')
  eq('CONFIRM on an unpaid order → 200', tooEarly.status, 200)
  check('   it says nothing was acted on', /not acted on/i.test(tooEarly.json?.note ?? ''), {
    note: tooEarly.json?.note,
  })
  const unpaidLines = await orderLines(orderRef)
  eq('DB: the order is STILL unpaid', unpaidLines.every((l) => l.status === 'pending'), true)
  eq('   and was not moved along', unpaidLines[0].fulfillment, null)
  eq(
    '   but the admin can see the customer asked',
    await prisma.orderEvent.count({ where: { orderRef, type: 'sms_inbound' } }),
    1
  )

  /* ---- 4. pay for it, which sends the texts ---- */
  const settled = await post(`/api/admin/orders/${orderRef}/settle`, { action: 'pay', method: 'cash' })
  must('settle the order → 200', settled.status === 200, { status: settled.status, body: settled.json })

  const orderLink = await linkFor('order', orderRef)
  const paidMsg = orderLink.messages.find((m) => m.template === 'order_paid')
  const placedMsg = orderLink.messages.find((m) => m.template === 'order_placed')
  must('the order_paid text went out', paidMsg?.status === 'sent', { status: paidMsg?.status })
  must(
    '   the gateway id was kept — a receipt has something to match',
    !!paidMsg.providerMessageId,
    { id: paidMsg?.providerMessageId }
  )

  /* ---- 5. a delivery receipt attaches to that message ---- */
  const delivered = await receipt('message.phone.delivered', paidMsg.providerMessageId, 'ev-deliv')
  eq('a delivered receipt → 200', delivered.status, 200)

  const afterDelivery = await prisma.customerMessage.findUnique({ where: { id: paidMsg.id } })
  eq('   the message now reads delivered', afterDelivery.deliveryStatus, 'delivered')
  check('   with a time', !!afterDelivery.deliveredAt)
  // Our own status is what WE did (handed it to the gateway) and must not be
  // rewritten by the gateway's opinion of what happened next.
  eq('   but our own status is untouched', afterDelivery.status, 'sent')

  // httpSMS retries. The same event must not be applied twice.
  const again = await receipt('message.phone.delivered', paidMsg.providerMessageId, 'ev-deliv')
  eq('the same receipt again → 200', again.status, 200)
  eq('   answered as a duplicate', again.json?.duplicate, true)
  eq(
    '   and stored exactly once',
    await prisma.smsEvent.count({
      where: { eventType: 'message.phone.delivered', providerMessageId: paidMsg.providerMessageId },
    }),
    1
  )

  // A send whose response was lost still carries request_id — our own id — so a
  // receipt naming that instead must find the message too.
  const viaRequestId = await receiptByRequestId('message.phone.sent', placedMsg.id, 'ev-sent')
  eq('a receipt naming our own id → 200', viaRequestId.status, 200)
  eq(
    '   matched through request_id',
    (await prisma.customerMessage.findUnique({ where: { id: placedMsg.id } })).deliveryStatus,
    'sent'
  )

  // The two failure receipts, which between them cover BOTH of the gateway's
  // naming quirks: `message.send.failed` names the message `id` and carries
  // `error_message`, while `message.send.expired` names it `message_id` and
  // carries no reason at all.
  must(
    'the order_placed text kept its gateway id too',
    !!placedMsg.providerMessageId,
    { id: placedMsg.providerMessageId }
  )
  const failed = await event(
    'message.send.failed',
    { id: placedMsg.providerMessageId, error_message: 'MOBILE_APP_INACTIVE' },
    'ev-failed'
  )
  eq('a failed receipt → 200', failed.status, 200)
  const afterFail = await prisma.customerMessage.findUnique({ where: { id: placedMsg.id } })
  eq('   the message reads failed', afterFail.deliveryStatus, 'failed')
  check(
    '   carrying the gateway’s own reason',
    /MOBILE_APP_INACTIVE/.test(afterFail.error ?? ''),
    { error: afterFail.error }
  )

  const expiredReceipt = await event(
    'message.send.expired',
    { message_id: placedMsg.providerMessageId },
    'ev-expired'
  )
  eq('an expired receipt (which names it message_id) → 200', expiredReceipt.status, 200)
  eq(
    '   matched, and reads expired',
    (await prisma.customerMessage.findUnique({ where: { id: placedMsg.id } })).deliveryStatus,
    'expired'
  )

  // A receipt for a message we have no row for must not invent one, and must not
  // fail loudly either — httpSMS would retry a lookup that can never succeed.
  const orphan = await receipt('message.phone.delivered', 'no-such-message-id', 'ev-orphan')
  eq('a receipt for an unknown message → 200', orphan.status, 200)
  check('   recorded as unmatched', /no message matched/i.test(orphan.json?.note ?? ''), {
    note: orphan.json?.note,
  })
  eq(
    '   and no delivery was claimed anywhere',
    await prisma.customerMessage.count({ where: { deliveryStatus: 'delivered' } }),
    1
  )

  /* ---- 6. CONFIRM on the paid order moves it ---- */
  const confirmed = await reply('CONFIRM', E164, 'in-confirm')
  eq('CONFIRM on a paid order → 200', confirmed.status, 200)
  eq('DB: the order is now Confirmed', (await orderLines(orderRef))[0].fulfillment, 'confirmed')
  eq(
    '   the timeline credits the customer, not an admin',
    await prisma.orderEvent.count({ where: { orderRef, type: 'confirmed', actor: 'sms' } }),
    1
  )

  const confirmMsg = await messageOn(orderLink.id, 'order_confirmed')
  must('   the customer is texted about it', !!confirmMsg)
  eq('   and it went out automatically', confirmMsg.sentBy, 'auto')
  check('   the gateway received it', confirmMsg.status === 'sent', { status: confirmMsg.status })

  const confirmedAgain = await reply('CONFIRM', E164, 'in-confirm-2')
  eq('a second CONFIRM → 200', confirmedAgain.status, 200)
  check('   it explains the order is already there', /already Confirmed/i.test(confirmedAgain.json?.note ?? ''), {
    note: confirmedAgain.json?.note,
  })
  eq('   and the stage did not move', (await orderLines(orderRef))[0].fulfillment, 'confirmed')

  /* ---- 7. ordinary chatter is kept, never obeyed ---- */
  const chatter = await reply('no problem thanks', E164, 'in-chatter')
  eq('an ordinary message → 200', chatter.status, 200)
  check('   not mistaken for CANCEL', /not recognised/i.test(chatter.json?.note ?? ''), {
    note: chatter.json?.note,
  })
  eq('   the order is untouched', (await orderLines(orderRef))[0].status, 'paid')
  eq(
    '   but it is on the record for a human to read',
    await prisma.smsEvent.count({ where: { body: 'no problem thanks' } }),
    1
  )

  /* ---- 8. CANCEL on a PAID order flags it — the money already moved ---- */
  const cancelPaid = await reply('CANCEL', E164, 'in-cancel-paid')
  eq('CANCEL on a paid order → 200', cancelPaid.status, 200)
  const paidLine = (await orderLines(orderRef))[0]
  eq('DB: the paid order is STILL paid', paidLine.status, 'paid')
  check('   and flagged for the office', !!paidLine.cancelRequestedAt)
  eq(
    '   the timeline records who asked',
    await prisma.orderEvent.count({ where: { orderRef, type: 'cancel_requested', actor: 'sms' } }),
    1
  )
  const cancelMsg = await messageOn(orderLink.id, 'order_cancel_requested')
  must('   the customer is answered', !!cancelMsg)
  check(
    '   without claiming it was cancelled',
    !/has been cancelled/i.test(cancelMsg.body),
    { body: cancelMsg.body }
  )
  // The flag is a QUESTION for the office, not an answer. The money must still be
  // banked and the donation must still be in the public fund.
  const paidSaleIds = (
    await prisma.sale.findMany({ where: { orderRef }, select: { id: true } })
  ).map((s) => s.id)
  eq(
    '   its donation is still in the fund',
    await prisma.fundEntry.count({
      where: { channel: 'sale', refId: { in: paidSaleIds }, status: 'paid' },
    }),
    1
  )

  /* ---- 9. CANCEL on an UNPAID order really cancels it ---- */
  const PHONE_UNPAID = '0775550002'
  const PHONE_SHARED = '0775550003'
  const PHONE_STRANGER = '0775550009'
  for (const p of [PHONE_UNPAID, PHONE_SHARED, PHONE_STRANGER]) {
    const n = await prisma.sale.count({ where: { customerPhone: p } })
    must(`the test number ${p} is unused in this DB copy`, n === 0, { n })
  }

  const unpaid = await post('/api/orders', {
    customerName: 'E2E SMS Unpaid',
    customerPhone: PHONE_UNPAID,
    customerEmail: 'sms-unpaid@example.com',
    items: [{ productId: product.id, quantity: 1 }],
  })
  must('place a second, unpaid order → 201', unpaid.status === 201, { body: unpaid.json })
  const unpaidRef = unpaid.json.orderRef

  const cancelled = await reply('0', '+94775550002', 'in-cancel-unpaid')
  eq('CANCEL (as "0") on an unpaid order → 200', cancelled.status, 200)
  eq(
    'DB: the order is cancelled',
    (await orderLines(unpaidRef)).every((l) => l.status === 'cancelled'),
    true
  )
  const unpaidLink = await linkFor('order', unpaidRef)
  must('   the customer is told', !!unpaidLink)
  check(
    '   with an order_cancelled message',
    unpaidLink.messages.some((m) => m.template === 'order_cancelled')
  )

  /* ---- 10. two live orders on one number: refuse to guess ---- */
  const sharedA = await post('/api/orders', {
    customerName: 'E2E SMS Shared A',
    customerPhone: PHONE_SHARED,
    customerEmail: 'shared-a@example.com',
    items: [{ productId: product.id, quantity: 1 }],
  })
  const sharedB = await post('/api/orders', {
    customerName: 'E2E SMS Shared B',
    customerPhone: PHONE_SHARED,
    customerEmail: 'shared-b@example.com',
    items: [{ productId: product.id, quantity: 1 }],
  })
  must('two orders share one number', sharedA.status === 201 && sharedB.status === 201)

  const ambiguous = await reply('CANCEL', '+94775550003', 'in-ambiguous')
  eq('a reply from a shared number → 200', ambiguous.status, 200)
  check('   it refuses to pick an order', /ambiguous/i.test(ambiguous.json?.note ?? ''), {
    note: ambiguous.json?.note,
  })
  const untouched = await orderLines(sharedA.json.orderRef)
  eq('   and NOTHING was cancelled', untouched.every((l) => l.status === 'pending'), true)

  /* ---- 11. a number with no order at all ---- */
  const stranger = await reply('CANCEL', '+94775550009', 'in-stranger')
  eq('a reply from an unknown number → 200', stranger.status, 200)
  check('   it says nothing matched', /no live order/i.test(stranger.json?.note ?? ''), {
    note: stranger.json?.note,
  })

  /* ---- 12. events we do not act on are stored and ignored ---- */
  const heartbeat = await event('phone.heartbeat.online', {}, 'ev-heartbeat')
  eq('a heartbeat → 200', heartbeat.status, 200)
  eq(
    '   stored for the record',
    await prisma.smsEvent.count({ where: { eventType: 'phone.heartbeat.online' } }),
    1
  )
  eq(
    '   and marked as unhandled rather than silently dropped',
    (await prisma.smsEvent.findFirst({ where: { eventType: 'phone.heartbeat.online' } }))?.error
      ?.includes('unhandled'),
    true
  )

  // Signed but event-less: authentic, and still not something to act on.
  const notAnEvent = await postWebhook(
    { hello: 'world' },
    { authorization: `Bearer ${signJwt({ hello: 'world' })}` }
  )
  eq('a signed body with no event in it → 400', notAnEvent.status, 400)

  /* ---- 13. the admin can SEE all of it ---- */
  // A reply that moved an order shows on that order's timeline. One that matched
  // nothing has no order to appear on, and silently dropping it is how a customer
  // ends up ignored — so the outbox lists them for a person to read.
  const list = await get('/api/admin/messages')
  eq('GET /api/admin/messages → 200', list.status, 200)
  const inbound = list.json?.inbound ?? []
  check('the admin list carries the customer replies', inbound.length >= 5, {
    n: inbound.length,
    bodies: inbound.map((r) => r.body),
  })
  const unattached = inbound.filter((r) => !r.orderRef)
  check('   including the ones that matched no order', unattached.length >= 3, {
    n: unattached.length,
  })
  check(
    '   each with the reason it went nowhere',
    unattached.every((r) => !!r.error),
    unattached.map((r) => r.error)
  )
  check(
    '   and the customer’s own words',
    inbound.some((r) => r.body === 'no problem thanks'),
    inbound.map((r) => r.body)
  )
  check(
    '   a reply that moved an order points at it',
    inbound.some((r) => r.orderRef === orderRef),
    inbound.map((r) => r.orderRef)
  )
}

/* ------------------------------------------------------------------ main -- */

const PHASES = { mock: phaseMock, fail: phaseFail, manual: phaseManual, webhook: phaseWebhook }

async function main() {
  if (!/sms-e2e/i.test(DB_URL)) {
    console.error(
      `\n\x1b[31mREFUSING TO RUN\x1b[0m: DATABASE_URL must point at db/sms-e2e.db (got "${DB_URL}").\n`
    )
    process.exit(2)
  }
  const run = PHASES[PHASE]
  if (!run) {
    console.error(`Unknown phase "${PHASE}" — expected one of ${Object.keys(PHASES).join(', ')}`)
    process.exit(2)
  }

  console.log(`\nSMS E2E — phase "${PHASE}" against ${BASE}`)
  console.log(`DB: ${DB_URL}`)

  try {
    await run()
  } catch (err) {
    if (err instanceof GuardFailed) console.error(`\n\x1b[31mPhase aborted at: ${err.message}\x1b[0m`)
    else console.error(`\n\x1b[31m${err.stack}\x1b[0m`)
    failed++
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`\x1b[1m[${PHASE}] ${passed} passed, ${failed} failed\x1b[0m`)
  if (failures.length) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`  \x1b[31m•\x1b[0m ${f}`)
  }

  await prisma.$disconnect()
  // Set the code and let Node drain its own handles; do NOT call process.exit().
  //
  // On Windows, exiting while libuv still holds closing async handles aborts the
  // process with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` and a
  // non-zero status — so a phase where every assertion PASSED was reported by the
  // harness as a failed phase. The failure was in the exit path, not the system
  // under test, which is the worst kind: it makes a green suite look red.
  //
  // Nothing here needs forcing: undici's keep-alive sockets go quiet on their own,
  // so the loop empties a few seconds after the last request.
  process.exitCode = failed === 0 ? 0 : 1
}

main()

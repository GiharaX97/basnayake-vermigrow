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

async function setup() {
  await cleanup()
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

  /* ---- 2. placing an online order must NOT send or spend ---- */
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
  eq('   STILL QUEUED — a pending order is not a sale', orderLink.messages[0].status, 'queued')
  const afterOrder = await get('/api/admin/messages')
  eq('   the order spent nothing', afterOrder.json?.autoSend?.sentToday, 1)

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

/* ------------------------------------------------------------------ main -- */

const PHASES = { mock: phaseMock, fail: phaseFail, manual: phaseManual }

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
  process.exit(failed === 0 ? 0 : 1)
}

main()

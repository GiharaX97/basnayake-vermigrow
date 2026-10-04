#!/usr/bin/env node
/**
 * Local test data for the order + SMS loop.
 *
 * ⚠️  THIS WRITES TO WHATEVER DB THE RUNNING SERVER USES — i.e. `db/custom.db`,
 * the working database, not a throwaway copy. It is meant for a localhost dev
 * server only. Never point it at the deployed site.
 *
 * It refuses to run against anything but localhost, so a stray BASE_URL cannot
 * turn "set up the demo" into "write a fake product and three fake orders into
 * the client's live database".
 *
 * What it makes, so the whole pipeline has something real to act on:
 *
 *   [LOCAL TEST] VermiGrow 1kg   — a product with a price, because the two real
 *                                  catalog items have price 0 and are therefore
 *                                  not orderable online at all
 *   one PENDING order            — CONFIRM on it must do nothing; CANCEL cancels it
 *   one PAID order               — CONFIRM advances it; CANCEL flags it, never cancels
 *
 * Every order uses TEST_PHONE (default: the farm's own test number), so a text
 * sent from a real handset to the gateway matches one of them.
 *
 * Everything it creates is named with the tag below. Delete it all with:
 *   node scripts/test-data.mjs --clean
 */
import { randomUUID } from 'node:crypto'

const BASE = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
/** The number a reply is expected to come FROM — the farm's own handset. */
const PHONE = process.env.TEST_PHONE || '+94773259724'
/**
 * The unpaid order goes on a DIFFERENT number, and not for tidiness:
 * `findOrderForPhone` refuses to act when a number has more than one live order,
 * because CONFIRM and CANCEL do very different things and guessing which order a
 * bare "0" meant is not a machine's call. Two live orders on one number would
 * make every reply come back "ambiguous — nothing was changed", which reads
 * exactly like a broken webhook. One live order per number keeps the demo honest.
 */
const PHONE_UNPAID = process.env.TEST_PHONE_UNPAID || '+94770000001'
const TAG = '[LOCAL TEST]'
const PRODUCT_NAME = `${TAG} VermiGrow 1kg`
const PRICE = 1500
const CLEAN = process.argv.includes('--clean')

let cookie = ''

function die(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

async function api(path, { method = 'GET', body, expect = [200, 201] } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* not JSON — leave null, the caller gets the raw text */
  }
  if (!expect.includes(res.status)) {
    die(
      `${method} ${path} → ${res.status}\n  ${json ? JSON.stringify(json) : text.slice(0, 300)}`
    )
  }
  return { status: res.status, json, text }
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  })
  if (res.status !== 200) die(`login failed (${res.status}). Is ADMIN_PASSWORD right?`)
  // getSetCookie() exists on Node 20+; the joined header is the fallback.
  const raw = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? '']
  const pair = raw.map((c) => c.split(';')[0]).filter(Boolean).join('; ')
  if (!pair) die('login succeeded but no session cookie came back')
  cookie = pair
}

/** 401 rather than a redirect, so a stale session is obvious. */
async function ensureLoggedIn() {
  const { status } = await api('/api/admin/orders', { expect: [200, 401] })
  if (status === 401) await login()
}

async function findOrCreateProduct() {
  const { json: products } = await api('/api/admin/products')
  const existing = products.find((p) => p.name === PRODUCT_NAME)
  if (existing) {
    // `--clean` deactivates rather than deletes (a product with sales cannot be
    // deleted), so a clean→setup cycle has to wake it back up or every order
    // below fails with "not orderable".
    if (!existing.active) {
      const { json } = await api(`/api/admin/products/${existing.id}`, {
        method: 'PATCH',
        body: { active: true },
      })
      return json
    }
    return existing
  }

  const { json } = await api('/api/admin/products', {
    method: 'POST',
    body: {
      name: PRODUCT_NAME,
      kind: 'product',
      price: PRICE,
      unit: 'per pack',
      description: 'Test item created by scripts/test-data.mjs — safe to delete.',
      donationPerUnit: 20,
      active: true,
    },
  })
  return json
}

/**
 * Test orders this script made on an earlier run.
 *
 * Reusing them keeps the order book — and the public donation total — from
 * growing every time someone re-runs the setup to pick up a fix.
 */
async function existingTestOrders() {
  const { json } = await api(`/api/admin/orders?q=${encodeURIComponent(TAG)}&status=all`)
  const mine = (json.orders ?? []).filter((o) =>
    String(o.customer?.name ?? '').startsWith(TAG)
  )
  return {
    pending: mine.find((o) => o.status === 'pending') ?? null,
    paid: mine.find((o) => o.status === 'paid') ?? null,
  }
}

async function placeOrder(product, { name, note, phone = PHONE }) {
  const { json } = await api('/api/orders', {
    method: 'POST',
    body: {
      customerName: name,
      customerPhone: phone,
      note,
      items: [{ productId: product.id, quantity: 1 }],
    },
  })
  return { orderRef: json.orderRef, total: json.total, token: json.receiptToken }
}

async function clean() {
  await ensureLoggedIn()
  const { json: orders } = await api('/api/admin/orders')
  const list = orders.orders ?? orders
  const mine = list.filter((o) => String(o.customer?.name ?? '').startsWith(TAG))
  for (const o of mine) {
    try {
      await api(`/api/admin/orders/${encodeURIComponent(o.orderRef)}/settle`, {
        method: 'POST',
        body: { action: 'cancel', note: 'local test cleanup' },
        expect: [200, 409],
      })
    } catch {
      /* already cancelled, or not cancellable — carry on */
    }
  }

  const { json: products } = await api('/api/admin/products')
  const product = products.find((p) => p.name === PRODUCT_NAME)
  if (product) {
    // Products with sales cannot be deleted — deactivating removes it from the
    // catalog, which is what "cleaned up" means for anything already ordered.
    const { status } = await api(`/api/admin/products/${product.id}`, {
      method: 'DELETE',
      expect: [200, 204, 409],
    })
    if (status === 409) {
      await api(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        body: { active: false },
        expect: [200],
      })
      console.log(`  ${PRODUCT_NAME} → deactivated (it has sales, so it cannot be deleted)`)
    }
  }

  console.log(`\nCancelled ${mine.length} test order(s) and removed the test product.`)
  console.log('Cancelled orders stay on the books by design — that is the audit trail.')
}

async function main() {
  console.log(`\nVermiGrow local test data — ${BASE}\n`)

  // The guard. This script writes real rows into whatever DB the server points
  // at, and the deployed site is one BASE_URL away — checking here is the cheap
  // version of not having to un-pick a fake product from the live catalog.
  const host = new URL(BASE).hostname
  if (!['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) {
    die(
      `${BASE} is not localhost.\n` +
        '  This script creates products and orders. It only runs against a local dev server.'
    )
  }

  // Fail fast and readably when nothing is listening, rather than dying on a
  // fetch stack trace three steps in.
  try {
    await fetch(`${BASE}/api/catalog`)
  } catch {
    die(`Nothing is answering on ${BASE}. Start the dev server first: npm run dev`)
  }

  await ensureLoggedIn()
  if (CLEAN) return clean()

  const product = await findOrCreateProduct()
  console.log(`product   ${product.name}  (id ${product.id}, LKR ${PRICE})`)

  const found = await existingTestOrders()

  let pending = found.pending
  if (pending) {
    console.log(`pending   ${pending.orderRef}  (kept from an earlier run)`)
  } else {
    pending = await placeOrder(product, {
      name: `${TAG} Pending order`,
      phone: PHONE_UNPAID,
      note: 'Local test: leave unpaid. CONFIRM must do nothing; CANCEL cancels it.',
    })
    console.log(`pending   ${pending.orderRef}  LKR ${pending.total}  (${PHONE_UNPAID})`)
  }

  let paid = found.paid
  if (paid) {
    console.log(`paid      ${paid.orderRef}  (kept from an earlier run)`)
  } else {
    paid = await placeOrder(product, {
      name: `${TAG} Paid order`,
      note: 'Local test: paid. CONFIRM advances it; CANCEL must only flag it.',
    })
    console.log(`paid      ${paid.orderRef}  LKR ${paid.total}  (${PHONE})`)

    await api(`/api/admin/orders/${encodeURIComponent(paid.orderRef)}/settle`, {
      method: 'POST',
      body: {
        action: 'pay',
        // A method is required on a pay — taking money with no record of how it
        // arrived would be a Payment row nobody can reconcile.
        method: 'cash',
        reference: 'local test',
        note: 'Local test: recorded as paid',
      },
    })
    console.log(`          ↑ settled as PAID (this queues an SMS; with SMS_PROVIDER=mock it lands in .sms-outbox.log)`)
  }

  console.log(`
Ready. Open the order book:  ${BASE}/admin/orders

  PAID     ${paid.orderRef}   from ${PHONE}
           → CONFIRM advances it to Confirmed. CANCEL only FLAGS it — never cancels.

  PENDING  ${pending.orderRef}   from ${PHONE_UNPAID}
           → CANCEL cancels it outright (no money moved). CONFIRM does nothing.

Text from ${PHONE} — that is the paid order's number, and the only live order on it:
  CONFIRM        advances it, and texts the customer back
  CANCEL         flags it for the office and changes nothing else
  "hello"        does nothing, but is still shown to you

Without a gateway, fire the same signed events locally:
  node scripts/simulate-reply.mjs CONFIRM
  node scripts/simulate-reply.mjs CANCEL --phone ${PHONE_UNPAID}

Undo all of this later with:
  node scripts/test-data.mjs --clean
`)
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)))

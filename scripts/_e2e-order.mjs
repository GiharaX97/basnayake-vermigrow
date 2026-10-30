// Place ONE real order through the public API and report what the app did with it.
//
// Exercises the whole chain the customer actually uses:
//   POST /api/orders  ->  autoDeliver  ->  configured provider (text-lk)
// then reads the CustomerMessage row back through the admin API, so the claim
// "it sent" is checked against the database rather than against itself.
//
// Costs one SMS unit.
//
// NOTE: no process.exit() anywhere. On Windows, exiting while libuv still holds
// closing handles aborts with `Assertion failed: !(handle->flags &
// UV_HANDLE_CLOSING)` and a non-zero status on a run where everything passed —
// the same trap scripts/e2e.mjs documents. process.exitCode lets Node drain.
//
// Usage: node scripts/_e2e-order.mjs [+94773259724]
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001'
const PHONE = process.argv[2] || '+94773259724'
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

const cat = await (await fetch(`${BASE}/api/catalog`)).json()
const products = Array.isArray(cat) ? cat : (cat.items ?? cat.products ?? cat.data ?? [])
const product = products.find((p) => p.active !== false && p.price > 0)

if (!product) {
  console.error('no active priced product in the catalog')
  process.exitCode = 1
} else {
  console.log(`product: ${product.name} (LKR ${product.price})`)

  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'TEXTLK E2E probe',
      customerPhone: PHONE,
      note: 'text.lk end-to-end check',
      items: [{ productId: product.id, quantity: 1 }],
    }),
  })
  const order = await res.json()
  console.log(`order HTTP ${res.status}  ref=${order.orderRef ?? '?'}  total=${order.total ?? '?'}`)

  if (!res.ok) {
    console.log(JSON.stringify(order).slice(0, 400))
    process.exitCode = 1
  } else {
    // Read it back through the admin API — the DB row, not the send's own opinion.
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    })
    const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')

    const admin = await (await fetch(`${BASE}/api/admin/messages`, { headers: { cookie } })).json()
    console.log(`provider: ${JSON.stringify(admin.provider)}`)

    const tail = PHONE.replace(/\D/g, '').slice(-9)
    const mine = (admin.messages ?? []).filter((m) =>
      String(m.toPhone ?? '').replace(/\D/g, '').endsWith(tail),
    )
    for (const m of mine.slice(0, 3)) {
      console.log(
        `  ${m.template}  status=${m.status}  deliveryStatus=${m.deliveryStatus ?? '-'}` +
          `  providerMessageId=${m.providerMessageId ?? '-'}  err=${m.error ?? '-'}`,
      )
    }
    if (!mine.length) console.log('  (no message row found for that number)')
  }
}

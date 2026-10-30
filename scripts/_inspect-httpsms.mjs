// Read-only probe of the httpSMS gateway. Needs HTTPSMS_API_KEY in the env.
// Usage: node scripts/_inspect-httpsms.mjs <contactE164> [ownerE164]
const key = process.env.HTTPSMS_API_KEY
if (!key) {
  console.error('no HTTPSMS_API_KEY in env')
  process.exit(1)
}
const contact = process.argv[2]
const owner = process.argv[3]
if (!contact) {
  console.error('usage: node scripts/_inspect-httpsms.mjs <contactE164> [ownerE164]')
  process.exit(1)
}

const url = new URL('https://api.httpsms.com/v1/messages')
url.searchParams.set('contact', contact)
if (owner) url.searchParams.set('owner', owner)

const res = await fetch(url, { headers: { 'x-api-key': key } })
const json = await res.json().catch(() => null)
if (!res.ok) {
  console.error('HTTP', res.status, JSON.stringify(json)?.slice(0, 400))
  process.exit(1)
}

const ts = (v) => (v ? String(v).slice(11, 19) : '   -    ')
const rows = (json.data ?? []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
console.log(`contact=${contact} owner=${owner ?? '(any)'}  ${rows.length} message(s)\n`)
for (const m of rows) {
  console.log(
    String(m.id).slice(0, 8),
    'made', ts(m.created_at),
    String(m.status).padEnd(8),
    String(m.failure_reason ?? '-').padEnd(16),
    `tries=${m.send_attempt_count ?? '?'}/${m.max_send_attempts ?? '?'}`,
    `sim=${m.sim ?? '?'}`,
    `attempted=${ts(m.last_attempted_at)}`,
    `sent=${ts(m.sent_at)}`,
    `deliv=${ts(m.delivered_at)}`,
    `failed=${ts(m.failed_at)}`,
  )
}

// One raw send to Text.lk, printing the exact HTTP code and body.
//
// The point is to see the response BEFORE the app interprets it: whether the
// real API returns `data.uid`, and whether a failure arrives as HTTP 200 with a
// boolean `status` — the two things src/lib/sms/providers/text-lk.ts depends on.
// Costs one SMS unit.
//
// Usage: node scripts/_probe-textlk.mjs 94764153470
const token = process.env.TEXTLK_API_TOKEN
const senderId = process.env.TEXTLK_SENDER_ID
const recipient = process.argv[2]

if (!token || !senderId) {
  console.error('need TEXTLK_API_TOKEN and TEXTLK_SENDER_ID in the environment')
  process.exit(1)
}
if (!recipient) {
  console.error('usage: node scripts/_probe-textlk.mjs <recipient, e.g. 94764153470>')
  process.exit(1)
}

const endpoint = process.env.TEXTLK_API_URL || 'https://app.text.lk/api/v3/sms/send'
const body = {
  recipient,
  sender_id: senderId,
  type: 'plain',
  message: 'VermiGrow: test message, please ignore.',
}

console.log(`POST ${endpoint}`)
console.log(`  sender_id=${senderId}  recipient=${recipient}\n`)

const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15_000),
})

const text = await res.text()
console.log(`HTTP ${res.status}`)
let json = null
try {
  json = JSON.parse(text)
} catch {
  /* non-JSON body: the raw text below is the whole story */
}
console.log(json ? JSON.stringify(json, null, 2) : text)

// Speak to what the adapter actually reads out of this.
console.log('\n--- what src/lib/sms/providers/text-lk.ts would conclude ---')
if (!res.ok) {
  console.log('  ok:false  (HTTP was not 2xx)')
} else if (json?.status === false) {
  console.log('  ok:false  (boolean status:false — the bug the guard had to be widened for)')
} else if (typeof json?.status === 'string' && json.status.toLowerCase() !== 'success') {
  console.log(`  ok:false  (status:"${json.status}")`)
} else {
  const uid = json?.data?.uid ?? json?.data?.sms_id
  console.log(`  ok:true   providerMessageId=${uid ? JSON.stringify(uid) : 'MISSING'}`)
  if (!uid) console.log('  ^ no id in the response: DLR would have nothing to match on')
}

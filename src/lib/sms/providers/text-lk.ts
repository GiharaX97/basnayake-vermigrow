import { postJson, errorText, missingEnv } from './_http'
import { toMsisdn } from '../msisdn'
import type { DeliveryResult } from '../types'

/**
 * Text.lk — https://text.lk/docs
 *
 * Bearer-token auth in the header, JSON body. Advertises ~LKR 0.64 per SMS,
 * which is why it was the recommendation for a farm's order volume.
 *
 * As with Notify.lk, a 2xx does not by itself mean the message was accepted:
 * the body carries its own `status`. Both are checked.
 *
 * The request shape (endpoint, Bearer header, body fields) was confirmed against
 * the published API docs on 2026-10-04. Still NOT exercised with live
 * credentials — the first real send is the test that counts. The endpoint is
 * overridable via TEXTLK_API_URL so a changed API version does not require a
 * code deploy.
 */
const ENDPOINT = process.env.TEXTLK_API_URL || 'https://app.text.lk/api/v3/sms/send'

export const requires = ['TEXTLK_API_TOKEN', 'TEXTLK_SENDER_ID']

export async function send(to: string, body: string): Promise<DeliveryResult> {
  const token = process.env.TEXTLK_API_TOKEN
  const senderId = process.env.TEXTLK_SENDER_ID || process.env.SMS_SENDER_ID

  if (!token || !senderId) return { ok: false, error: missingEnv(requires) }

  const res = await postJson(
    ENDPOINT,
    {
      recipient: toMsisdn(to),
      sender_id: senderId,
      type: 'plain',
      message: body,
    },
    { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  )

  if (!res.ok) return { ok: false, error: errorText(res) }

  const json = res.json as
    | { status?: unknown; data?: { uid?: unknown; sms_id?: unknown } }
    | null

  // The status guard has to accept BOTH spellings the gateway uses. Success is
  // `"status": "success"` or `"status": true`; failure is `"status": "error"`
  // or — and this is the one that bites — `"status": false`, a BOOLEAN, still
  // returned with HTTP 200. A check written only for the string form lets a
  // rejected message ("Invalid recipient number", insufficient balance, an
  // unapproved sender ID) fall through and be recorded as sent.
  const status = json?.status
  const failed =
    status === false || (typeof status === 'string' && status.toLowerCase() !== 'success')
  if (failed) return { ok: false, error: errorText(res) }

  // `data.uid` is the gateway's own id for this text, and the key its delivery
  // receipts quote back — GET /api/v3/sms/{uid} returns the same row. Without it
  // an inbound "delivered" has nothing to match against, so the Messages tab
  // could only ever say "handed over". `sms_id` is the other documented spelling.
  const uid = json?.data?.uid ?? json?.data?.sms_id
  const providerMessageId = typeof uid === 'string' && uid ? uid : undefined

  return { ok: true, providerMessageId }
}

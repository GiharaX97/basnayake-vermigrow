import { postJson, errorText, missingEnv } from './_http'
import { toMsisdn } from '../msisdn'
import type { DeliveryResult } from '../types'

/**
 * Notify.lk — https://www.notify.lk
 *
 * Credentials ride in the JSON body, not a header: `user_id`, `api_key`,
 * `sender_id`. This is the shape the account dashboard hands out.
 *
 * Note the response convention, which is easy to get wrong: Notify.lk answers
 * HTTP 200 with `{"status":"error","message":"..."}` for application-level
 * failures — insufficient balance, an unapproved sender ID, a malformed number.
 * Checking only `res.ok` would record every one of those as a successful send
 * and the customer would never be told anything. So the body's `status` is
 * checked too.
 *
 * NOT VERIFIED against a live account — no credentials exist yet. Confirm the
 * endpoint and response shape against the dashboard's API page before the first
 * real send, and expect to adjust `errorText` if their field names differ.
 */
const ENDPOINT = 'https://app.notify.lk/api/v1/send'

export const requires = ['NOTIFY_USER_ID', 'NOTIFY_API_KEY', 'NOTIFY_SENDER_ID']

export async function send(to: string, body: string): Promise<DeliveryResult> {
  const userId = process.env.NOTIFY_USER_ID
  const apiKey = process.env.NOTIFY_API_KEY
  const senderId = process.env.NOTIFY_SENDER_ID || process.env.SMS_SENDER_ID

  if (!userId || !apiKey || !senderId) return { ok: false, error: missingEnv(requires) }

  const res = await postJson(ENDPOINT, {
    user_id: userId,
    api_key: apiKey,
    sender_id: senderId,
    to: toMsisdn(to),
    message: body,
  })

  if (!res.ok) return { ok: false, error: errorText(res) }

  const status = (res.json as { status?: string } | null)?.status
  if (typeof status === 'string' && status.toLowerCase() !== 'success') {
    return { ok: false, error: errorText(res) }
  }
  return { ok: true }
}

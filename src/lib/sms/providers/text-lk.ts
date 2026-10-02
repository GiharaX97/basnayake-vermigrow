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
 * NOT VERIFIED against a live account. The endpoint is overridable via
 * TEXTLK_API_URL so a changed API version does not require a code deploy.
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

  const status = (res.json as { status?: string } | null)?.status
  if (typeof status === 'string' && status.toLowerCase() !== 'success') {
    return { ok: false, error: errorText(res) }
  }
  return { ok: true }
}

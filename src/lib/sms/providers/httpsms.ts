import { postJson, errorText, missingEnv } from './_http'
import { toE164 } from '../msisdn'
import type { DeliveryResult } from '../types'

/**
 * httpSMS — https://httpsms.com (https://github.com/NdoleStudio/httpsms)
 *
 * Unlike every other provider here, there is no SMS company in the middle: an
 * Android phone running the httpSMS app is the gateway. An API call queues the
 * message, the phone collects it and sends it from its own SIM. No sender ID to
 * register, no per-message fee to a gateway — just the SIM's own credit, which
 * is why this was the option worth adding for a farm.
 *
 * WHAT THAT MEANS OPERATIONALLY, and the admin should know it:
 *
 * 1. `from` IS A REAL PHONE NUMBER, not an alphanumeric sender ID. Customers see
 *    the farm's own number and can reply to it. That is an advantage; it is also
 *    why HTTPSMS_FROM is a separate variable rather than sharing SMS_SENDER_ID.
 * 2. The phone must be switched on, online, and running the app. A 2xx here means
 *    the message was ACCEPTED INTO THE PHONE'S QUEUE — not that it was sent, and
 *    certainly not that it arrived. If the handset is flat or offline, messages
 *    pile up on it and this API is none the wiser. The receipt link and the
 *    admin's Messages tab remain the source of truth for what the customer did.
 * 3. Both numbers must be E.164 with the leading `+`. Hence toE164 rather than the
 *    bare MSISDN the Sri Lankan gateways want.
 *
 * AGPL-3.0. Self-hostable (Docker, needs Firebase and rebuilding the Android app
 * against your own config); the hosted service at httpsms.com is the quick path.
 */
const ENDPOINT = process.env.HTTPSMS_API_URL || 'https://api.httpsms.com/v1/messages/send'

export const requires = ['HTTPSMS_API_KEY', 'HTTPSMS_FROM']

export async function send(to: string, body: string): Promise<DeliveryResult> {
  const apiKey = process.env.HTTPSMS_API_KEY
  const from = process.env.HTTPSMS_FROM

  if (!apiKey || !from) return { ok: false, error: missingEnv(requires) }

  const res = await postJson(
    ENDPOINT,
    {
      content: body,
      from: toE164(from),
      to: toE164(to),
    },
    { 'x-api-key': apiKey, Accept: 'application/json' }
  )

  if (!res.ok) return { ok: false, error: errorText(res) }
  return { ok: true }
}

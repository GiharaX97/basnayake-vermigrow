import { postJson, errorText, missingEnv } from './_http'
import { toE164 } from '../msisdn'
import type { DeliveryResult, SmsSendOptions } from '../types'

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
 * 4. THE RESPONSE IS KEPT, where the other providers throw theirs away. `data.id`
 *    is the phone's own id for the message, and it is the only key that can join
 *    a later `message.phone.delivered` webhook back to the row in our outbox.
 *    `request_id` goes the other way: we label the message with OUR
 *    CustomerMessage id, so an event can be tied to a row even when the send
 *    response never arrived.
 *
 * AGPL-3.0. Self-hostable (Docker, needs Firebase and rebuilding the Android app
 * against your own config); the hosted service at httpsms.com is the quick path.
 */
const ENDPOINT = process.env.HTTPSMS_API_URL || 'https://api.httpsms.com/v1/messages/send'

export const requires = ['HTTPSMS_API_KEY', 'HTTPSMS_FROM']

export async function send(
  to: string,
  body: string,
  options?: SmsSendOptions
): Promise<DeliveryResult> {
  const apiKey = process.env.HTTPSMS_API_KEY
  const from = process.env.HTTPSMS_FROM

  if (!apiKey || !from) return { ok: false, error: missingEnv(requires) }

  const res = await postJson(
    ENDPOINT,
    {
      content: body,
      from: toE164(from),
      to: toE164(to),
      // Only sent when we have one, so the request body stays exactly what the
      // gateway documented for callers that have no id to give it.
      ...(options?.requestId ? { request_id: options.requestId } : {}),
    },
    { 'x-api-key': apiKey, Accept: 'application/json' }
  )

  if (!res.ok) return { ok: false, error: errorText(res) }

  // `data.id` is read defensively: a 2xx is a successful send whatever the body
  // looks like, and failing the send because we could not parse an id would trade
  // a working delivery for a tidier database. A missing id only means receipts
  // for this message cannot be matched, which the admin sees as "Sent" with no
  // delivery state — the honest outcome.
  const data = (res.json as { data?: { id?: unknown } } | null)?.data
  const id = typeof data?.id === 'string' && data.id ? data.id : undefined
  return { ok: true, providerMessageId: id }
}

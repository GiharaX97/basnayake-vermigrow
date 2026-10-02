import { postJson, errorText, missingEnv } from './_http'
import type { DeliveryResult } from '../types'

/**
 * The original generic webhook, kept working as a named provider.
 *
 * Before this folder existed, `sendViaGateway()` (src/lib/notify.ts) POSTed
 * `{to, message, sender}` to SMS_GATEWAY_URL with an optional bearer token. That
 * shape is nobody's real API, but it is what any existing deployment is
 * configured against — including a self-hosted bridge like Kannel, or a tiny
 * relay script — so it stays, unchanged, as the `webhook` provider.
 *
 * It is also what an unset SMS_PROVIDER falls back to when SMS_GATEWAY_URL is
 * present, so a server configured before this refactor keeps sending exactly as
 * it did.
 */
export const requires = ['SMS_GATEWAY_URL']

export async function send(to: string, body: string): Promise<DeliveryResult> {
  const url = process.env.SMS_GATEWAY_URL
  if (!url) return { ok: false, error: missingEnv(requires) }

  const key = process.env.SMS_GATEWAY_KEY
  const res = await postJson(
    url,
    { to, message: body, sender: process.env.SMS_SENDER_ID ?? undefined },
    key ? { Authorization: `Bearer ${key}` } : {}
  )

  if (!res.ok) return { ok: false, error: errorText(res) }
  return { ok: true }
}

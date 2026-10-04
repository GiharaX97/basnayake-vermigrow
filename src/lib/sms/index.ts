import type { DeliveryResult, SmsSendOptions, SmsSender } from './types'
import * as mock from './providers/mock'
import * as webhook from './providers/webhook'
import * as notifyLk from './providers/notify-lk'
import * as textLk from './providers/text-lk'
import * as httpSms from './providers/httpsms'

/**
 * Which gateway actually transmits a text.
 *
 * THERE IS NO DEFAULT GATEWAY, ON PURPOSE. With SMS_PROVIDER unset and no
 * SMS_GATEWAY_URL, `configuredProvider()` returns 'manual' and nothing is ever
 * transmitted — the admin sends from their own phone and the app records it.
 * That is how this system shipped, and it is the only setting that costs nothing
 * and cannot misfire.
 *
 * Choosing a provider is an explicit act: set SMS_PROVIDER (and its credentials)
 * in the server's environment file. That is the whole "command".
 */

interface ProviderModule {
  /** Env vars this provider cannot work without. */
  requires: string[]
  send: SmsSender
}

const PROVIDERS: Record<string, ProviderModule> = {
  mock: { requires: mock.requires, send: mock.send },
  webhook: { requires: webhook.requires, send: webhook.send },
  'notify-lk': { requires: notifyLk.requires, send: notifyLk.send },
  'text-lk': { requires: textLk.requires, send: textLk.send },
  httpsms: { requires: httpSms.requires, send: httpSms.send },
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS)

/**
 * The provider name in effect, or 'manual'.
 *
 * The SMS_GATEWAY_URL fallback is deliberate: servers configured before this
 * module existed have that variable and nothing else, and `activeTransport()`
 * used to answer 'http' for them. Dropping the fallback would silently downgrade
 * a live deployment to manual, where `deliverMessage` records every message as
 * sent without transmitting a thing.
 */
export function configuredProvider(): string {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase()
  if (explicit) return explicit
  return process.env.SMS_GATEWAY_URL ? 'webhook' : 'manual'
}

export type Transport = 'manual' | 'http'

/**
 * Whether tapping Send transmits anything. Note this is 'http' for an UNKNOWN
 * provider name too — it must be, because the alternative degrades to manual,
 * which marks the message `sent` without sending it. A misconfigured provider
 * has to surface as a failed send the admin can see, not as a silent false
 * record of delivery.
 */
export function activeTransport(): Transport {
  return configuredProvider() === 'manual' ? 'manual' : 'http'
}

export interface ProviderStatus {
  transport: Transport
  provider: string
  requires: string[]
  missing: string[]
  /** True only when a real provider is selected and every credential it needs is present. */
  ready: boolean
}

/**
 * What the admin UI reports. Reading this leaks no secret — it names variables
 * and whether they are set, never their values.
 */
export function providerStatus(): ProviderStatus {
  const provider = configuredProvider()
  const mod = PROVIDERS[provider]
  const requires = mod?.requires ?? []
  const missing = requires.filter((name) => !process.env[name])
  return {
    transport: provider === 'manual' ? 'manual' : 'http',
    provider,
    requires,
    missing,
    ready: Boolean(mod) && missing.length === 0,
  }
}

/**
 * Hand the message to the configured gateway.
 *
 * Never throws — a provider outage must come back as `{ ok: false }` so the
 * caller can mark the row failed, rather than unwinding into a 500 that leaves
 * the admin unsure whether anything was sent. Each provider upholds the same
 * contract; this only picks one and covers the misconfigured case.
 */
export async function sendSms(
  to: string,
  body: string,
  options?: SmsSendOptions
): Promise<DeliveryResult> {
  const provider = configuredProvider()
  const mod = PROVIDERS[provider]

  if (!mod) {
    return {
      ok: false,
      error: `Unknown SMS_PROVIDER "${provider}" — expected one of: ${PROVIDER_NAMES.join(', ')}`,
    }
  }

  return mod.send(to, body, options)
}

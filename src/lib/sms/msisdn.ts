/**
 * Normalise a phone number into the bare MSISDN form the gateways expect.
 *
 * Every Sri Lankan gateway wants `94771234567` — no plus, no spaces, no dashes,
 * and country code rather than the trunk `0`. The numbers stored on Sale and
 * Donation come from a public form that accepts `077 123 4567`, `+94 77 123
 * 4567` and `0771234567` alike (see PHONE_REGEX in src/lib/notify.ts), so the
 * conversion has to happen somewhere, once, rather than in each provider.
 *
 * The country code is configurable because the app is not fundamentally
 * Sri-Lankan-only — it defaults to 94 because that is where this farm is.
 */

const DEFAULT_COUNTRY = process.env.SMS_COUNTRY_CODE?.replace(/\D/g, '') || '94'

export function toMsisdn(phone: string, countryCode: string = DEFAULT_COUNTRY): string {
  // Keep an explicit international prefix marked, so we don't mistake a number
  // that already carries its country code for a local one.
  const hadPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''

  if (hadPlus) return digits
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return countryCode + digits.slice(1)
  if (digits.startsWith(countryCode)) return digits
  return countryCode + digits
}

/**
 * The same number in E.164 — with the leading `+`.
 *
 * Two conventions live in this space and they are not interchangeable: the Sri
 * Lankan gateways want the bare `94771234567`, while httpSMS (an Android phone
 * acting as the gateway) wants `+94771234567`. Sending the wrong one is not
 * always an error the provider reports — some accept the bare form and deliver
 * to the wrong country — so each provider asks for the shape it documents rather
 * than sharing one "normalised" string.
 */
export function toE164(phone: string, countryCode: string = DEFAULT_COUNTRY): string {
  const msisdn = toMsisdn(phone, countryCode)
  return msisdn ? `+${msisdn}` : ''
}

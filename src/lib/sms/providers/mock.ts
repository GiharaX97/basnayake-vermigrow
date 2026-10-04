import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { toE164 } from '../msisdn'
import type { DeliveryResult, SmsSendOptions } from '../types'

/**
 * Development provider. Writes the message to a file instead of sending it.
 *
 * This is what makes the whole pipeline testable without a gateway account:
 * queue a message, auto-send it, hit the daily cap, fail a send — all of it can
 * be exercised on localhost, with the result visible in `.sms-outbox.log`
 * (gitignored). Without it, the only way to test the send path would be to buy
 * SMS credits and text a real phone.
 *
 * Set SMS_MOCK_FAIL=1 to make every send fail, so the failure branch — the
 * message marked `failed` with the error visible in the admin — can be tested
 * too. A provider that can only succeed is not testable.
 *
 * The number is written in E.164 rather than as it was handed in, so the log
 * shows what a real gateway would receive rather than what the form collected.
 * That difference is the whole reason src/lib/sms/msisdn.ts exists, and a mock
 * that skipped it would hide a number-normalisation bug from the test that is
 * supposed to catch one.
 *
 * It also returns a `providerMessageId`, which a real gateway would. Without one
 * the entire delivery-receipt path — webhook, id lookup, `deliveryStatus` — could
 * only ever be tested against a live phone, which is precisely the thing the mock
 * exists to avoid.
 */
const LOG_PATH = process.env.SMS_MOCK_LOG || join(process.cwd(), '.sms-outbox.log')

export const requires: string[] = []

export async function send(
  to: string,
  body: string,
  options?: SmsSendOptions
): Promise<DeliveryResult> {
  if (process.env.SMS_MOCK_FAIL === '1' || process.env.SMS_MOCK_FAIL === 'true') {
    return { ok: false, error: 'mock provider configured to fail (SMS_MOCK_FAIL)' }
  }

  const line =
    `[${new Date().toISOString()}] to=${toE164(to)}` +
    `${options?.requestId ? ` request_id=${options.requestId}` : ''} body=${JSON.stringify(body)}\n`
  try {
    await appendFile(LOG_PATH, line, 'utf8')
    // Predictable, not random: a test that asserts a receipt names this message
    // would otherwise have to read the id back out of the provider first.
    const id = options?.requestId ? `mock-${options.requestId}` : `mock-${Date.now()}`
    return { ok: true, providerMessageId: id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'could not write mock log' }
  }
}

/**
 * The contract between the outbox and whatever actually transmits a text.
 *
 * Kept in its own module so notify.ts (which owns the queue) and the individual
 * providers (which know nothing about the queue) can both depend on the shape
 * without depending on each other.
 */

export interface DeliveryResult {
  ok: boolean
  error?: string
  /**
   * The gateway's own id for this message, when it gives one.
   *
   * This is what lets a delivery receipt find its way home. A later webhook says
   * "message <id> was delivered", and without this the app has no way to know
   * which of the customer's messages that was — so the Messages tab could only
   * ever say "we handed it over", never "it arrived".
   *
   * Optional because most gateways here return a bare 2xx with nothing in it;
   * only httpSMS and the mock provider fill it in.
   */
  providerMessageId?: string
}

/**
 * Anything a provider may need beyond the two strings.
 *
 * Passed as one object rather than growing the argument list, so adding a field
 * for one gateway does not change the signature of four others. A provider that
 * does not understand an option ignores it — that is the whole point.
 */
export interface SmsSendOptions {
  /**
   * Our own identifier for this message, echoed back by the gateway and carried
   * on the message's webhook events.
   *
   * We send the `CustomerMessage.id`. It is the belt to `providerMessageId`'s
   * braces: the provider's id is only known AFTER a send succeeds, so a message
   * whose send response was lost still has something the gateway can quote back
   * at us.
   */
  requestId?: string
}

/**
 * One provider. MUST NOT THROW — a gateway outage has to come back as
 * `{ ok: false }` so the caller can mark a message failed, rather than
 * unwinding into a 500 that leaves the admin unsure whether anything was sent.
 */
export type SmsSender = (
  to: string,
  body: string,
  options?: SmsSendOptions
) => Promise<DeliveryResult>

export interface ProviderInfo {
  /** Value of SMS_PROVIDER that selects this provider. */
  name: string
  /** Environment variables this provider needs. Used for the operator-facing error text. */
  requires: string[]
}

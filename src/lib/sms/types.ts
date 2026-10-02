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
}

/**
 * One provider. MUST NOT THROW — a gateway outage has to come back as
 * `{ ok: false }` so the caller can mark a message failed, rather than
 * unwinding into a 500 that leaves the admin unsure whether anything was sent.
 */
export type SmsSender = (to: string, body: string) => Promise<DeliveryResult>

export interface ProviderInfo {
  /** Value of SMS_PROVIDER that selects this provider. */
  name: string
  /** Environment variables this provider needs. Used for the operator-facing error text. */
  requires: string[]
}

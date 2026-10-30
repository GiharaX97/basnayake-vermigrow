import { z } from 'zod'

/**
 * Shared vocabulary for money-receiving events.
 *
 * Cash in hand and bank transfers are recorded by an admin. `card` is written by
 * the Payments.lk webhook (src/lib/payments-lk.ts) after the provider confirms
 * the money — a card payment never bypasses the same settle path, so the ledger
 * cannot tell the two apart by accident.
 */

/**
 * How money physically arrived. `reload` is currently unused by any writer — it
 * is reserved for the reverse-vending-machine payouts described in the plan, so
 * the vocabulary does not have to change when that lands. `other` exists so an
 * unusual receipt can be recorded honestly instead of being forced into a wrong
 * bucket, which would corrupt the reconciliation report later.
 *
 * Statuses and methods are plain strings validated here rather than Prisma
 * enums: the SQLite connector does not support enums.
 */
export const paymentMethodSchema = z.enum(['cash', 'bank_transfer', 'card', 'reload', 'other'])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const PAYMENT_METHODS = paymentMethodSchema.options

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash in hand',
  bank_transfer: 'Bank transfer',
  card: 'Card (Payments.lk)',
  reload: 'Phone reload',
  other: 'Other',
}

/** Empty form fields mean "not set", which is NULL in the DB, not `''`. */
export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? null : v),
    z.string().trim().max(max).nullable()
  )

/**
 * When a pending order stops looking like "a customer on their way in" and
 * starts looking forgotten. Drives a badge in the admin Orders tab only —
 * nothing expires automatically, because seats are held until an admin cancels.
 */
export const STALE_PENDING_HOURS = 48

export function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / 36e5
}

/**
 * The status of a whole order, folded up from its lines.
 *
 * A multi-line order is several `Sale` rows sharing one `orderRef` (see the
 * schema comment), but it is one thing to the person who placed it — so the
 * admin UI needs one answer. `pending` wins over everything except a fully
 * cancelled order: an order with any unpaid line still needs chasing.
 *
 * `mixed` should not occur in practice (the settle route moves every pending
 * line at once); it exists so an unexpected state shows as itself rather than
 * being silently rounded to 'paid'.
 */
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'mixed'

export function deriveOrderStatus(lineStatuses: string[]): OrderStatus {
  if (lineStatuses.length === 0) return 'cancelled'
  if (lineStatuses.every((s) => s === 'cancelled')) return 'cancelled'
  if (lineStatuses.some((s) => s === 'pending')) return 'pending'
  if (lineStatuses.every((s) => s === 'paid')) return 'paid'
  return 'mixed'
}

/**
 * Raised when an order is not in a state that allows the requested action —
 * settling an already-settled order, or cancelling one that has no live lines.
 * Typed so the route answers 409 with a real explanation instead of a 500.
 */
export class OrderStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderStateError'
  }
}

/**
 * Body for settling an order. Discriminated on `action` so that `method` is
 * required when taking money and rejected when not — a cancel has no receipt,
 * and accepting one would write a `Payment` row for money nobody received.
 */
export const settleSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pay'),
    method: paymentMethodSchema,
    /** Bank slip no. / transaction id — what reconciles against the statement. */
    reference: optionalText(120),
    /** Which admin took the money. */
    receivedBy: optionalText(120),
    note: optionalText(500),
  }),
  z.object({
    action: z.literal('cancel'),
    note: optionalText(500),
  }),
])

export type SettleInput = z.infer<typeof settleSchema>

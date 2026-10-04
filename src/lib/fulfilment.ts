import { z } from 'zod'
import { optionalText } from '@/lib/payments'
import type { Template } from '@/lib/notify'

/**
 * The fulfilment pipeline for an online order, and the rules for moving along it.
 *
 * Kept apart from `Sale.status` on purpose. That column means "has the money
 * arrived", and it drives seat capacity (ACTIVE_SALE_STATUSES), the sold counts
 * and the donation ledger — so packing a box must never touch it. This file is
 * the other axis: what has been DONE with a paid order.
 *
 * `new` is never stored. It is `Sale.fulfillment IS NULL`, so every order that
 * existed before this feature reads as New with no backfill and no table rewrite.
 */

/** The storable stages, in pipeline order. */
export const FULFILMENT_STAGES = ['confirmed', 'packed', 'dispatched', 'delivered'] as const
export type FulfilmentStage = (typeof FULFILMENT_STAGES)[number]

/** What the admin UI shows, including the implicit first stage. */
export type FulfilmentStatus = 'new' | FulfilmentStage

/** Every stage, first to last — the order used for comparisons and the stepper. */
export const FULFILMENT_ORDER: readonly FulfilmentStatus[] = ['new', ...FULFILMENT_STAGES]

/**
 * `dispatched` is deliberately labelled "Sent to customer", NOT "Dispatched".
 * `Pack.status = 'dispatched'` and the `Dispatch` model already mean stock sent
 * to a RETAILER; an order on its way to a customer is a different journey, and
 * two features quietly sharing one word is how they get confused later.
 */
export const FULFILMENT_LABELS: Record<FulfilmentStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  packed: 'Packed',
  dispatched: 'Sent to customer',
  delivered: 'Delivered',
}

export function stageIndex(status: FulfilmentStatus): number {
  return FULFILMENT_ORDER.indexOf(status)
}

/** Any string from the DB as a known stage; anything unknown reads as New. */
export function normaliseStage(value: string | null | undefined): FulfilmentStatus {
  return (FULFILMENT_STAGES as readonly string[]).includes(value ?? '')
    ? (value as FulfilmentStage)
    : 'new'
}

/**
 * The order's stage, folded up from its lines — the LEAST advanced live line
 * wins, the same shape as `deriveOrderStatus`. An order is only "Delivered" when
 * every line is; one line left behind must not be rounded up to the others.
 *
 * Cancelled lines are ignored entirely: a cancelled order's stage is meaningless,
 * and the caller shows `Cancelled` from the payment status instead.
 */
export function deriveFulfilment(
  lineFulfilments: { fulfillment: string | null; status: string }[]
): FulfilmentStatus {
  const live = lineFulfilments.filter((l) => l.status !== 'cancelled')
  if (live.length === 0) return 'new'
  return live.reduce<FulfilmentStatus>((lowest, line) => {
    const stage = normaliseStage(line.fulfillment)
    return stageIndex(stage) < stageIndex(lowest) ? stage : lowest
  }, 'delivered')
}

/**
 * Where an order may move next, from where it is now.
 *
 * Forward jumps are allowed (a local pickup often goes straight to delivered,
 * and forcing three clicks would only produce dishonest timestamps), but a step
 * BACK is always offered so a mis-click is fixable rather than permanent. Every
 * move writes an `OrderEvent`, so the timeline stays an honest record either way.
 *
 * Cancelling is not here: it is a money question, handled by the settle route.
 */
export function allowedStages(current: FulfilmentStatus): FulfilmentStatus[] {
  const i = stageIndex(current)
  const out = FULFILMENT_ORDER.slice(i + 1)
  if (i > 0) out.unshift(FULFILMENT_ORDER[i - 1]!)
  return out
}

/** The one message each forward stage sends. A revert sends nothing. */
export const STAGE_TEMPLATES: Record<FulfilmentStage, Template> = {
  confirmed: 'order_confirmed',
  packed: 'order_packed',
  dispatched: 'order_dispatched',
  delivered: 'order_delivered',
}

/**
 * The service flag written when a customer replies CANCEL to an order that has
 * already been paid. It is NOT a cancellation — see `cancelRequestedAt` in the
 * schema — so it gets its own message rather than reusing `order_cancelled`,
 * which would tell them something untrue.
 */
export const CANCEL_REQUESTED_TEMPLATE = 'order_cancel_requested' as const

/**
 * Body for the admin order-status route. Discriminated so an internal note can
 * never be confused with a customer-facing stage move.
 */
export const orderStatusSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_stage'),
    stage: z.enum(FULFILMENT_STAGES),
    note: optionalText(500),
  }),
  z.object({
    action: z.literal('note'),
    note: z.string().trim().min(1, 'Write something first').max(1000),
  }),
  z.object({
    action: z.literal('dismiss_cancel_request'),
    note: optionalText(500),
  }),
])

export type OrderStatusInput = z.infer<typeof orderStatusSchema>

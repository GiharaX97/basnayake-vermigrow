'use client'

import { CheckCircle2 } from 'lucide-react'
import {
  FULFILMENT_LABELS,
  type FulfilmentStatus,
} from '@/lib/fulfilment'
import type { OrderStatus } from '@/lib/payments'

/**
 * The two badges an order always wears.
 *
 * They are deliberately separate pills rather than one merged state, because an
 * order genuinely has two answers at once — "paid, and packed" — and collapsing
 * them into a single word would make the admin guess which question is being
 * answered. One shared file so the list, the detail page and the timeline cannot
 * render the same state three different ways.
 */

const PILL =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap'
const AMBER = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
const GREEN = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
const MUTED = 'bg-muted text-muted-foreground'
const BLUE = 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'

const PAYMENT_LABELS: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
  mixed: 'Part-settled',
}

const PAYMENT_STYLES: Record<OrderStatus, string> = {
  pending: AMBER,
  paid: GREEN,
  cancelled: MUTED,
  mixed: AMBER,
}

export function PaymentBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`${PILL} ${PAYMENT_STYLES[status] ?? MUTED}`}>
      {status === 'paid' && <CheckCircle2 className="size-3" />}
      {PAYMENT_LABELS[status] ?? status}
    </span>
  )
}

const FULFILMENT_STYLES: Record<FulfilmentStatus, string> = {
  new: MUTED,
  confirmed: BLUE,
  packed: BLUE,
  dispatched: AMBER,
  delivered: GREEN,
}

/**
 * Fulfilment. A cancelled order shows Cancelled here too — the pipeline stage it
 * had reached is kept on the timeline for the record, but a cancelled order is
 * not "packed" in any sense the admin cares about at a glance.
 */
export function FulfilmentBadge({
  status,
  paymentStatus,
}: {
  status: FulfilmentStatus
  paymentStatus: OrderStatus
}) {
  if (paymentStatus === 'cancelled') {
    return <span className={`${PILL} ${MUTED}`}>Cancelled</span>
  }
  return (
    <span className={`${PILL} ${FULFILMENT_STYLES[status]}`}>
      {FULFILMENT_LABELS[status]}
    </span>
  )
}

/** The amber flag raised by a customer's CANCEL reply on an order they paid for. */
export function CancelRequestedBadge() {
  return <span className={`${PILL} ${AMBER}`}>Cancel requested</span>
}

/**
 * "3 days" / "5 h" — how long a pending order has been waiting.
 *
 * Shared by the list and the detail page so the same order cannot read as "2 days"
 * in one place and "48 h" in the other.
 */
export function formatAge(hours: number): string {
  if (hours < 1) return 'just now'
  if (hours < 24) return `${Math.floor(hours)} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day' : `${days} days`
}

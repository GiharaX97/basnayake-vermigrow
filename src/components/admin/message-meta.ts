/**
 * How a queued message is labelled and coloured.
 *
 * Extracted from messages-tab.tsx so the order detail page's SMS history and the
 * outbox in Donations cannot disagree about what "order_packed" is called or what
 * colour "failed" is. Adding a template in src/lib/notify.ts means adding a line
 * here, or the admin sees a raw snake_case identifier.
 */

export const TEMPLATE_LABELS: Record<string, string> = {
  order_placed: 'Order placed',
  order_paid: 'Payment received',
  order_cancelled: 'Order cancelled',
  // The fulfilment pipeline — one per stage an admin can move an order to.
  order_confirmed: 'Order confirmed',
  order_packed: 'Order packed',
  order_dispatched: 'Sent to customer',
  order_delivered: 'Order delivered',
  order_cancel_requested: 'Cancel request acknowledged',
  sale_thanks: 'Store purchase',
  scan_thanks: 'Pack scanned',
  gift_thanks: 'Gift given',
}

/** Our outbox's own state — whether WE managed to hand the message over. */
export const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  skipped: 'bg-muted text-muted-foreground',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

export const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  sent: 'Sent',
  skipped: 'Skipped',
  failed: 'Failed',
}

/**
 * The PROVIDER's word, kept apart from `status` on purpose.
 *
 * A 2xx from httpSMS only means "accepted into the phone's queue", so our
 * `status` never claims delivery. This is what the phone itself reports later,
 * through a webhook. Deliberately a second vocabulary: our 'sent' + their
 * 'delivered' is the honest pair, and merging them would let the admin believe a
 * text arrived because we managed to hand it to a gateway.
 */
export const DELIVERY_STYLES: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  sent: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

export const DELIVERY_LABELS: Record<string, string> = {
  delivered: 'Delivered',
  sent: 'Left the phone',
  failed: 'Delivery failed',
  expired: 'Delivery expired',
}

import { prisma } from './prisma'
import { formatLkr } from './currency'
import { TEMPLATE_LABELS } from '@/components/admin/message-meta'

/**
 * The admin notification feed.
 *
 * The admin panel previously had no single answer to "did anything arrive that
 * I need to act on?" — an admin had to open Donations, Orders, Inquiries and the
 * Messages tab separately, and a new pledge or a failed SMS could sit unseen
 * for days. This module is that answer: one call aggregates every row that is
 * WAITING ON A PERSON and returns both the counts and a merged, newest-first
 * list of the items themselves.
 *
 * Deliberately action-scoped, not event-scoped. A "sent" message, a "paid"
 * order or a "read" inquiry is not a notification — it is a completed thing.
 * Only states that are stuck without an admin appear here, so the badge going
 * to zero genuinely means "nothing needs me":
 *
 *   donation   Donation.status = 'pending'   a public pledge awaiting confirmation
 *   order      Sale.status     = 'pending'   an online order awaiting payment received
 *   cancel     cancelRequestedAt != null     a paid order the customer asked to cancel
 *   message    CustomerMessage.status='failed'  a text the gateway refused
 *   inquiry    Inquiry.status  = 'unread'    a contact-form message nobody opened
 *
 * Every query is bounded and independent, so this stays cheap enough to poll.
 * The sale queries group by `orderRef` because an order is the unit an admin
 * acts on — counting LINES would report a three-item order as three jobs.
 */

export type AdminNotificationKind = 'donation' | 'order' | 'cancel' | 'message' | 'inquiry'

export interface AdminNotificationItem {
  /** Stable across polls, so React keys and "new since last seen" work. */
  id: string
  kind: AdminNotificationKind
  title: string
  detail: string
  href: string
  createdAt: string
  /** Pledges and paid-order cancels carry the money at stake. */
  amount?: number
}

export interface AdminNotificationSummary {
  counts: {
    donations: number
    orders: number
    cancellations: number
    failedMessages: number
    inquiries: number
    total: number
  }
  items: AdminNotificationItem[]
  generatedAt: string
}

/** How many recent items of each kind to fetch for the merged list. */
const PER_KIND_LIMIT = 10
/** How many merged items the bell/dashboard renders. */
const ITEM_LIMIT = 12

function clip(value: string | null | undefined, max = 90): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

type OrderSummary = { customerName: string | null; total: number; lineCount: number }

/**
 * Name and money for a set of orders, from their Sale lines.
 *
 * One query for every ref rather than N queries: the bell polls this, so the
 * number of round-trips matters more than the shape of the result. The total is
 * quantity × unitPrice (the sale-time snapshot), matching what the Orders page
 * shows, and never the live product price.
 */
async function summariseOrders(refs: string[]): Promise<Map<string, OrderSummary>> {
  const summaries = new Map<string, OrderSummary>()
  if (refs.length === 0) return summaries

  const lines = await prisma.sale.findMany({
    where: { orderRef: { in: refs } },
    select: { orderRef: true, customerName: true, quantity: true, unitPrice: true },
  })

  for (const line of lines) {
    if (!line.orderRef) continue
    const existing = summaries.get(line.orderRef) ?? {
      customerName: null,
      total: 0,
      lineCount: 0,
    }
    existing.total += line.quantity * line.unitPrice
    existing.lineCount += 1
    if (!existing.customerName && line.customerName) {
      existing.customerName = line.customerName
    }
    summaries.set(line.orderRef, existing)
  }
  return summaries
}

export async function getAdminNotifications(): Promise<AdminNotificationSummary> {
  const [
    pendingDonationCount,
    pendingDonations,
    pendingOrderGroups,
    cancelRequestGroups,
    failedMessageCount,
    failedMessages,
    unreadInquiryCount,
    unreadInquiries,
  ] = await Promise.all([
    prisma.donation.count({ where: { status: 'pending' } }),
    prisma.donation.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: PER_KIND_LIMIT,
      select: {
        id: true,
        amount: true,
        donorName: true,
        donorPhone: true,
        note: true,
        createdAt: true,
      },
    }),
    // No `take`: the length is the COUNT of orders awaiting payment, and a
    // second capped query would risk the badge and the list disagreeing.
    // Admin order volume is small; the group is per order, not per line.
    prisma.sale.groupBy({
      by: ['orderRef'],
      where: { source: 'online', orderRef: { not: null }, status: 'pending' },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    }),
    prisma.sale.groupBy({
      by: ['orderRef'],
      where: {
        source: 'online',
        orderRef: { not: null },
        status: 'paid',
        cancelRequestedAt: { not: null },
      },
      _max: { cancelRequestedAt: true, createdAt: true },
      orderBy: { _max: { cancelRequestedAt: 'desc' } },
    }),
    prisma.customerMessage.count({ where: { status: 'failed' } }),
    prisma.customerMessage.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: PER_KIND_LIMIT,
      select: {
        id: true,
        toName: true,
        toPhone: true,
        template: true,
        error: true,
        createdAt: true,
      },
    }),
    prisma.inquiry.count({ where: { status: 'unread' } }),
    prisma.inquiry.findMany({
      where: { status: 'unread' },
      orderBy: { createdAt: 'desc' },
      take: PER_KIND_LIMIT,
      select: { id: true, name: true, email: true, message: true, createdAt: true },
    }),
  ])

  const pendingRefs = pendingOrderGroups
    .map((group) => group.orderRef)
    .filter((ref): ref is string => ref !== null)
  const cancelRefs = cancelRequestGroups
    .map((group) => group.orderRef)
    .filter((ref): ref is string => ref !== null)

  const recentPendingRefs = pendingRefs.slice(0, PER_KIND_LIMIT)
  const recentCancelRefs = cancelRefs.slice(0, PER_KIND_LIMIT)

  const summaries = await summariseOrders([
    ...new Set([...recentPendingRefs, ...recentCancelRefs]),
  ])

  const orderCreatedAt = new Map<string, Date | null>()
  for (const group of pendingOrderGroups) {
    if (group.orderRef) orderCreatedAt.set(group.orderRef, group._max.createdAt)
  }
  const cancelCreatedAt = new Map<string, { requested: Date | null; placed: Date | null }>()
  for (const group of cancelRequestGroups) {
    if (!group.orderRef) continue
    cancelCreatedAt.set(group.orderRef, {
      requested: group._max.cancelRequestedAt,
      placed: group._max.createdAt,
    })
  }

  const items: AdminNotificationItem[] = []

  for (const donation of pendingDonations) {
    const who = donation.donorName || 'Anonymous giver'
    const contact = [
      who,
      donation.donorPhone ? clip(donation.donorPhone, 40) : '',
    ].filter(Boolean)
    const detail = `${contact.join(' · ')} — awaiting confirmation${
      donation.note ? ` — ${clip(donation.note, 60)}` : ''
    }`
    items.push({
      id: `donation:${donation.id}`,
      kind: 'donation',
      title: `New donation pledge — ${formatLkr(donation.amount)}`,
      detail,
      href: '/admin/donations?tab=direct',
      createdAt: donation.createdAt.toISOString(),
      amount: donation.amount,
    })
  }

  for (const ref of recentPendingRefs) {
    const summary = summaries.get(ref)
    const createdAt = orderCreatedAt.get(ref)
    items.push({
      id: `order:${ref}`,
      kind: 'order',
      title: `New order ${ref}`,
      detail: `${summary?.customerName || 'Customer'}${
        summary ? ` · ${formatLkr(summary.total)}` : ''
      } · awaiting payment`,
      href: `/admin/orders/${encodeURIComponent(ref)}`,
      createdAt: (createdAt ?? new Date()).toISOString(),
      amount: summary?.total,
    })
  }

  for (const ref of recentCancelRefs) {
    const summary = summaries.get(ref)
    const times = cancelCreatedAt.get(ref)
    const createdAt = times?.requested ?? times?.placed ?? new Date()
    items.push({
      id: `cancel:${ref}`,
      kind: 'cancel',
      title: `Cancellation requested — ${ref}`,
      detail: `${summary?.customerName || 'Customer'} asked to cancel a paid order${
        summary ? ` · ${formatLkr(summary.total)}` : ''
      }`,
      href: `/admin/orders/${encodeURIComponent(ref)}`,
      createdAt: createdAt.toISOString(),
      amount: summary?.total,
    })
  }

  for (const message of failedMessages) {
    const recipient = message.toName || message.toPhone || 'recipient'
    const label = TEMPLATE_LABELS[message.template] ?? message.template
    items.push({
      id: `message:${message.id}`,
      kind: 'message',
      title: `SMS failed — ${label}`,
      detail: `${recipient}${message.error ? ` · ${clip(message.error, 70)}` : ''}`,
      href: '/admin/donations?tab=messages',
      createdAt: message.createdAt.toISOString(),
    })
  }

  for (const inquiry of unreadInquiries) {
    items.push({
      id: `inquiry:${inquiry.id}`,
      kind: 'inquiry',
      title: `New inquiry from ${inquiry.name}`,
      detail: `${inquiry.email}${inquiry.message ? ` — ${clip(inquiry.message, 70)}` : ''}`,
      href: '/admin/inquiries',
      createdAt: inquiry.createdAt.toISOString(),
    })
  }

  // ISO 8601 strings compare chronologically, so no Date parsing per comparison.
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

  const counts = {
    donations: pendingDonationCount,
    orders: pendingRefs.length,
    cancellations: cancelRefs.length,
    failedMessages: failedMessageCount,
    inquiries: unreadInquiryCount,
    total:
      pendingDonationCount +
      pendingRefs.length +
      cancelRefs.length +
      failedMessageCount +
      unreadInquiryCount,
  }

  return {
    counts,
    items: items.slice(0, ITEM_LIMIT),
    generatedAt: new Date().toISOString(),
  }
}

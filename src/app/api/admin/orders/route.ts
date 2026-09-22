import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { deriveOrderStatus, hoursSince, STALE_PENDING_HOURS } from '@/lib/payments'

/** Newest N orders. Bounded by ORDERS, not lines — see the groupBy below. */
const MAX_ORDERS = 100

/**
 * Customer-placed orders, grouped from their `Sale` lines by `orderRef`.
 *
 * The grouping happens here rather than in the browser so the cap is on orders:
 * fetching the newest N *sales* and grouping afterwards would slice a
 * multi-line order at the boundary and show a total that never existed.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const groups = await prisma.sale.groupBy({
    by: ['orderRef'],
    where: { source: 'online', orderRef: { not: null } },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: MAX_ORDERS,
  })
  const orderRefs = groups
    .map((g) => g.orderRef)
    .filter((ref): ref is string => ref !== null)

  if (orderRefs.length === 0) {
    return NextResponse.json({
      orders: [],
      pendingCount: 0,
      stalePendingCount: 0,
      pendingTotal: 0,
      pendingDonation: 0,
    })
  }

  const [lines, payments] = await Promise.all([
    prisma.sale.findMany({
      where: { orderRef: { in: orderRefs } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderRef: true,
        quantity: true,
        unitPrice: true,
        donationAmount: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        note: true,
        createdAt: true,
        product: { select: { name: true, kind: true, unit: true } },
      },
    }),
    prisma.payment.findMany({
      where: { orderRef: { in: orderRefs } },
      orderBy: { receivedAt: 'desc' },
      select: {
        id: true,
        orderRef: true,
        amount: true,
        method: true,
        reference: true,
        receivedBy: true,
        receivedAt: true,
      },
    }),
  ])

  const byRef = new Map<string, typeof lines>()
  for (const line of lines) {
    if (!line.orderRef) continue
    const bucket = byRef.get(line.orderRef)
    if (bucket) bucket.push(line)
    else byRef.set(line.orderRef, [line])
  }

  const orders = orderRefs.flatMap((orderRef) => {
    const orderLines = byRef.get(orderRef)
    if (!orderLines || orderLines.length === 0) return []

    const status = deriveOrderStatus(orderLines.map((l) => l.status))
    const createdAt = orderLines.reduce(
      (min, l) => (l.createdAt < min ? l.createdAt : min),
      orderLines[0].createdAt
    )
    const ageHours = hoursSince(createdAt)
    // Every line of a settled order shares the same paymentMethod; a paid line
    // is the proof one exists.
    const paidLine = orderLines.find((l) => l.paidAt)

    return [
      {
        orderRef,
        status,
        lines: orderLines.map((l) => ({
          id: l.id,
          name: l.product.name,
          kind: l.product.kind,
          unit: l.product.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.unitPrice * l.quantity,
          donationAmount: l.donationAmount,
          status: l.status,
        })),
        // The buyer is the same on every line; the first non-null wins because
        // one line could in principle have been edited by hand.
        customer: {
          name: orderLines.find((l) => l.customerName)?.customerName ?? null,
          phone: orderLines.find((l) => l.customerPhone)?.customerPhone ?? null,
          email: orderLines.find((l) => l.customerEmail)?.customerEmail ?? null,
        },
        note: orderLines.find((l) => l.note)?.note ?? null,
        total: orderLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
        donationTotal: orderLines.reduce((s, l) => s + l.donationAmount, 0),
        createdAt: createdAt.toISOString(),
        ageHours,
        isStale: status === 'pending' && ageHours >= STALE_PENDING_HOURS,
        paidAt: paidLine?.paidAt?.toISOString() ?? null,
        paymentMethod: paidLine?.paymentMethod ?? '',
        payment: payments.find((p) => p.orderRef === orderRef) ?? null,
      },
    ]
  })

  const pending = orders.filter((o) => o.status === 'pending')

  return NextResponse.json({
    orders,
    pendingCount: pending.length,
    stalePendingCount: pending.filter((o) => o.isStale).length,
    pendingTotal: pending.reduce((s, o) => s + o.total, 0),
    // What the public wall would gain if every pending order were settled —
    // deliberately NOT the same as what has been counted, which is zero.
    pendingDonation: pending.reduce((s, o) => s + o.donationTotal, 0),
  })
}

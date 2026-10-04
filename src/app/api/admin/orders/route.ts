import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { deriveOrderStatus, hoursSince, STALE_PENDING_HOURS } from '@/lib/payments'
import { FULFILMENT_STAGES, deriveFulfilment, type FulfilmentStatus } from '@/lib/fulfilment'

/** Newest N orders. Bounded by ORDERS, not lines — see the groupBy below. */
const MAX_ORDERS = 100
const HARD_MAX_ORDERS = 200

/**
 * Customer-placed orders, grouped from their `Sale` lines by `orderRef`.
 *
 * The grouping happens here rather than in the browser so the cap is on orders:
 * fetching the newest N *sales* and grouping afterwards would slice a
 * multi-line order at the boundary and show a total that never existed.
 *
 * `q` and `fulfilment` are pushed into the groupBy's WHERE, so the cap still
 * counts matching ORDERS. `status` (the payment state) is DERIVED from the lines
 * and so can only be applied after grouping — which means a status-filtered page
 * may come back shorter than `limit`. That is honest, and the alternative (cap
 * the raw rows and then filter) would hide orders.
 */
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const q = params.get('q')?.trim() ?? ''
  const fulfilmentFilter = params.get('fulfilment')?.trim() ?? ''
  const statusFilter = params.get('status')?.trim() ?? ''
  const limitRaw = Number.parseInt(params.get('limit') ?? '', 10)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, HARD_MAX_ORDERS)
      : MAX_ORDERS

  const where: Prisma.SaleWhereInput = { source: 'online', orderRef: { not: null } }
  if (q) {
    where.OR = [
      { orderRef: { contains: q } },
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { customerEmail: { contains: q } },
    ]
  }
  if (fulfilmentFilter === 'new') {
    where.fulfillment = null
  } else if ((FULFILMENT_STAGES as readonly string[]).includes(fulfilmentFilter)) {
    where.fulfillment = fulfilmentFilter
  }

  const groups = await prisma.sale.groupBy({
    by: ['orderRef'],
    where,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: limit,
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
      stageCounts: emptyStageCounts(),
      truncated: groups.length >= limit,
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
        fulfillment: true,
        fulfillmentAt: true,
        cancelRequestedAt: true,
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

  const mapped = orderRefs.flatMap((orderRef) => {
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

    // Fulfilment is moved on every live line at once, so the latest stamp is the
    // order's. Cancelled lines are ignored by deriveFulfilment.
    const fulfillmentAt = latest(orderLines.map((l) => l.fulfillmentAt))
    const cancelRequestedAt = latest(orderLines.map((l) => l.cancelRequestedAt))

    return [
      {
        orderRef,
        status,
        fulfillment: deriveFulfilment(
          orderLines.map((l) => ({ fulfillment: l.fulfillment, status: l.status }))
        ),
        fulfillmentAt: fulfillmentAt?.toISOString() ?? null,
        cancelRequestedAt: cancelRequestedAt?.toISOString() ?? null,
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

  const shown =
    statusFilter && statusFilter !== 'all'
      ? mapped.filter((o) => o.status === statusFilter)
      : mapped

  const pending = shown.filter((o) => o.status === 'pending')

  return NextResponse.json({
    orders: shown,
    pendingCount: pending.length,
    stalePendingCount: pending.filter((o) => o.isStale).length,
    pendingTotal: pending.reduce((s, o) => s + o.total, 0),
    // What the public wall would gain if every pending order were settled —
    // deliberately NOT the same as what has been counted, which is zero.
    pendingDonation: pending.reduce((s, o) => s + o.donationTotal, 0),
    stageCounts: countStages(shown),
    // True when the cap may have cut the list short, so the UI can say so rather
    // than implying these are all the orders there are.
    truncated: groups.length >= limit,
  })
}

/** The newest non-null stamp across an order's lines. */
function latest(stamps: (Date | null)[]): Date | null {
  return stamps.reduce<Date | null>((max, stamp) => {
    if (!stamp) return max
    return !max || stamp > max ? stamp : max
  }, null)
}

type StageCounts = Record<FulfilmentStatus, number> & {
  cancelled: number
  cancelRequested: number
}

function emptyStageCounts(): StageCounts {
  return {
    new: 0,
    confirmed: 0,
    packed: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    cancelRequested: 0,
  }
}

/**
 * How the CURRENT page of orders distributes across the pipeline. Computed over
 * what is shown, not over the whole table — a tile that ignored the filters above
 * it would contradict the list under it.
 */
function countStages(
  orders: { status: string; fulfillment: FulfilmentStatus; cancelRequestedAt: string | null }[]
): StageCounts {
  const counts = emptyStageCounts()
  for (const order of orders) {
    if (order.status === 'cancelled') counts.cancelled++
    else counts[order.fulfillment]++
    // A flag, not a stage: an order can be both 'packed' and awaiting a decision.
    if (order.cancelRequestedAt) counts.cancelRequested++
  }
  return counts
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { deriveOrderStatus, hoursSince, STALE_PENDING_HOURS } from '@/lib/payments'
import { allowedStages, deriveFulfilment } from '@/lib/fulfilment'

/**
 * Everything about one order, in one response: the lines and money, the people
 * and their messages, the fulfilment state, and the timeline that explains it.
 *
 * The detail page is the only consumer, and it is deliberately ONE request — an
 * order screen that renders half of itself while three more fetches land is a
 * screen an admin cannot trust when a customer is on the phone.
 *
 * `allowedStages` comes from the server, not the browser: the transition rules
 * are the same ones the status route enforces, so the UI cannot offer a move the
 * API will refuse.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderRef: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { orderRef } = await params

  const lines = await prisma.sale.findMany({
    where: { orderRef },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
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
  })

  if (lines.length === 0) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const [payments, events, link, vouchers] = await Promise.all([
    prisma.payment.findMany({
      where: { orderRef },
      orderBy: { receivedAt: 'desc' },
      select: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        receivedBy: true,
        note: true,
        receivedAt: true,
      },
    }),
    prisma.orderEvent.findMany({
      where: { orderRef },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        fromStage: true,
        toStage: true,
        actor: true,
        note: true,
        createdAt: true,
      },
    }),
    // The one link that covers this order, if the customer was ever texted. Its
    // messages are the SMS history; the link itself is not returned, because the
    // token is a WRITE capability (see the CustomerLink schema comment) and the
    // admin has no use for it.
    prisma.customerLink.findUnique({
      where: { refType_refId: { refType: 'order', refId: orderRef } },
      select: { id: true, revokedAt: true, expiresAt: true },
    }),
    prisma.pack.findMany({
      where: { orderRef },
      orderBy: { createdAt: 'asc' },
      select: {
        code: true,
        status: true,
        holderName: true,
        redeemedAt: true,
        deliveredAt: true,
      },
    }),
  ])

  const messages = link
    ? await prisma.customerMessage.findMany({
        where: { linkId: link.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          template: true,
          body: true,
          status: true,
          toName: true,
          toPhone: true,
          sentAt: true,
          sentBy: true,
          error: true,
          providerMessageId: true,
          deliveryStatus: true,
          deliveredAt: true,
          createdAt: true,
        },
      })
    : []

  const status = deriveOrderStatus(lines.map((l) => l.status))
  const fulfillment = deriveFulfilment(
    lines.map((l) => ({ fulfillment: l.fulfillment, status: l.status }))
  )
  const createdAt = lines.reduce(
    (min, l) => (l.createdAt < min ? l.createdAt : min),
    lines[0].createdAt
  )
  const ageHours = hoursSince(createdAt)
  const paidLine = lines.find((l) => l.paidAt)
  const customer = {
    name: lines.find((l) => l.customerName)?.customerName ?? null,
    phone: lines.find((l) => l.customerPhone)?.customerPhone ?? null,
    email: lines.find((l) => l.customerEmail)?.customerEmail ?? null,
  }

  return NextResponse.json({
    order: {
      orderRef,
      status,
      // Fulfilment is meaningless on a cancelled order, and the UI shows
      // 'Cancelled' from the payment status instead.
      fulfillment,
      fulfillmentAt: latest(lines.map((l) => l.fulfillmentAt))?.toISOString() ?? null,
      cancelRequestedAt: latest(lines.map((l) => l.cancelRequestedAt))?.toISOString() ?? null,
      lines: lines.map((l) => ({
        id: l.id,
        name: l.product.name,
        kind: l.product.kind,
        unit: l.product.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.unitPrice * l.quantity,
        donationAmount: l.donationAmount,
        status: l.status,
        fulfillment: l.fulfillment,
      })),
      customer,
      note: lines.find((l) => l.note)?.note ?? null,
      total: lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
      donationTotal: lines.reduce((s, l) => s + l.donationAmount, 0),
      createdAt: createdAt.toISOString(),
      ageHours,
      isStale: status === 'pending' && ageHours >= STALE_PENDING_HOURS,
      paidAt: paidLine?.paidAt?.toISOString() ?? null,
      paymentMethod: paidLine?.paymentMethod ?? '',
      payments,
      vouchers,
      // Only a fully paid order can be moved along — an unpaid one has to have its
      // money recorded first, or the customer's receipt would contradict its
      // status. The same rule the status route enforces.
      allowedStages: status === 'paid' ? allowedStages(fulfillment) : [],
      canPay: lines.some((l) => l.status === 'pending'),
      canCancel: status !== 'cancelled' && lines.some((l) => l.status !== 'cancelled'),
      link: link
        ? { revokedAt: link.revokedAt?.toISOString() ?? null, expiresAt: link.expiresAt?.toISOString() ?? null }
        : null,
    },
    events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    messages: messages.map((m) => ({
      ...m,
      sentAt: m.sentAt?.toISOString() ?? null,
      deliveredAt: m.deliveredAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  })
}

/** The newest non-null stamp across an order's lines. */
function latest(stamps: (Date | null)[]): Date | null {
  return stamps.reduce<Date | null>((max, stamp) => {
    if (!stamp) return max
    return !max || stamp > max ? stamp : max
  }, null)
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'

const MAX_PAYMENTS = 200

/**
 * The money-receipt audit trail: every event where money actually changed
 * hands, newest first.
 *
 * This is deliberately a flat list rather than something derived from sales:
 * an order is settled by ONE receipt regardless of how many lines it has, and a
 * cancelled order keeps its receipt (see the settle route). Summing this list
 * tells the accountant what was received, by which method, against which
 * reference — which is a different question from what the donation wall shows.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payments = await prisma.payment.findMany({
    orderBy: { receivedAt: 'desc' },
    take: MAX_PAYMENTS,
    include: {
      sale: {
        select: {
          id: true,
          orderRef: true,
          retailer: true,
          customerName: true,
          product: { select: { name: true } },
        },
      },
      donation: { select: { id: true, donorName: true } },
    },
  })

  return NextResponse.json({ payments })
}

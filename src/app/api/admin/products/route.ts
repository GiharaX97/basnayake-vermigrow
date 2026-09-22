import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { productSchema } from '@/lib/product-schema'
import { ACTIVE_SALE_STATUSES } from '@/lib/orders'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [products, committed] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      // Counted sales only: a 'pending' row is an order placed online that has not
      // been paid for, and 'cancelled' is one that never will be. Counting either
      // would overstate how much of this product has actually moved.
      include: { _count: { select: { sales: { where: { status: 'paid' } } } } },
    }),
    // SEATS, not rows: `_count.sales` above counts sale rows, so a booking of 3
    // seats reads as 1. The capacity guard compares against the sum of quantity,
    // so the admin view has to as well or the two disagree about a workshop that
    // is actually full. Pending orders hold seats (they are counted committed),
    // which is why this uses the same status set the booking guard does.
    prisma.sale.groupBy({
      by: ['productId'],
      where: { status: { in: [...ACTIVE_SALE_STATUSES] } },
      _sum: { quantity: true },
    }),
  ])

  const takenBy = new Map(committed.map((c) => [c.productId, c._sum.quantity ?? 0]))
  return NextResponse.json(
    products.map((p) => ({ ...p, seatsTaken: takenBy.get(p.id) ?? 0 }))
  )
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = productSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const product = await prisma.product.create({ data: result.data })
  return NextResponse.json(product, { status: 201 })
}

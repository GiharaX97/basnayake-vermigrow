import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { z } from 'zod'

const dispatchSchema = z.object({
  retailer: z.string().transform((v) => v.trim()).pipe(z.string().min(1, 'Retailer is required').max(120)),
  productId: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().int('Must be a whole number').min(1, 'Must be at least 1').max(5000),
  note: z.string().transform((v) => v.trim()).pipe(z.string().max(300)).optional(),
})

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dispatches = await prisma.dispatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      packs: { select: { status: true, product: { select: { name: true } } } },
    },
  })

  // Fold per-pack rows into sell-through numbers
  const rows = dispatches.map((d) => {
    const byProduct = new Map<string, { total: number; sold: number }>()
    for (const p of d.packs) {
      const name = p.product.name
      const entry = byProduct.get(name) ?? { total: 0, sold: 0 }
      entry.total++
      if (p.status === 'sold') entry.sold++
      byProduct.set(name, entry)
    }
    return {
      id: d.id,
      retailer: d.retailer,
      note: d.note,
      createdAt: d.createdAt,
      totalPacks: d.packs.length,
      soldPacks: d.packs.filter((p) => p.status === 'sold').length,
      products: [...byProduct.entries()].map(([name, v]) => ({ name, ...v })),
    }
  })
  return NextResponse.json(rows)
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

  const result = dispatchSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { retailer, productId, quantity, note } = result.data
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const available = await prisma.pack.count({ where: { productId, status: 'in_warehouse' } })
  if (available < quantity) {
    return NextResponse.json(
      { error: `Only ${available} pack(s) of this product in the warehouse. Generate more first.` },
      { status: 400 }
    )
  }

  // FIFO: dispatch the oldest generated packs first
  const packs = await prisma.pack.findMany({
    where: { productId, status: 'in_warehouse' },
    orderBy: { createdAt: 'asc' },
    take: quantity,
    select: { id: true, code: true },
  })

  const dispatch = await prisma.dispatch.create({ data: { retailer, note: note || null } })
  // dispatchId is a plain scalar column, so updateMany can link + flip in one go
  await prisma.pack.updateMany({
    where: { id: { in: packs.map((p) => p.id) } },
    data: { status: 'dispatched', dispatchedAt: new Date(), dispatchId: dispatch.id },
  })

  return NextResponse.json(
    {
      id: dispatch.id,
      retailer: dispatch.retailer,
      packs: packs.map((p) => p.code),
    },
    { status: 201 }
  )
}

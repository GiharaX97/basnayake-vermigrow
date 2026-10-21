import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { generatePackCodes } from '@/lib/pack-codes'
import { z } from 'zod'

const STALE_DAYS = 30

const generateSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().int('Must be a whole number').min(1, 'Must be at least 1').max(5000, 'Max 5000 per batch'),
})

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const dispatchId = url.searchParams.get('dispatchId')

  // Single pack lookup with full scan history
  if (code) {
    const pack = await prisma.pack.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        product: { select: { name: true } },
        dispatch: { select: { retailer: true } },
        scans: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!pack) return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    return NextResponse.json(pack)
  }

  // Codes of a dispatch (for the printable QR sticker sheet)
  if (dispatchId) {
    const packs = await prisma.pack.findMany({
      where: { dispatchId },
      orderBy: { createdAt: 'asc' },
      select: { code: true, status: true, product: { select: { name: true } } },
    })
    return NextResponse.json(packs)
  }

  // Overview: stock by status + anomaly flags
  const [byStatus, rescanned, stalePacks] = await Promise.all([
    prisma.pack.groupBy({ by: ['status'], _count: true }),
    prisma.pack.findMany({
      where: { scanCount: { gt: 1 } },
      orderBy: { scanCount: 'desc' },
      take: 20,
      select: {
        id: true, code: true, scanCount: true, status: true,
        product: { select: { name: true } },
      },
    }),
    prisma.pack.findMany({
      where: {
        status: 'dispatched',
        dispatchedAt: { lt: new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true, code: true, dispatchedAt: true,
        product: { select: { name: true } },
        dispatch: { select: { retailer: true } },
      },
      orderBy: { dispatchedAt: 'asc' },
      take: 200,
    }),
  ])

  const stats = { in_warehouse: 0, dispatched: 0, sold: 0 }
  for (const row of byStatus) {
    stats[row.status as keyof typeof stats] = row._count
  }

  // Group stale packs per retailer for a compact "unaccounted" view
  const staleByRetailer = new Map<string, { retailer: string; count: number; oldest: Date; products: Set<string> }>()
  for (const p of stalePacks) {
    const key = p.dispatch?.retailer ?? 'Unknown'
    const entry = staleByRetailer.get(key) ?? {
      retailer: key, count: 0, oldest: p.dispatchedAt!, products: new Set<string>(),
    }
    entry.count++
    entry.products.add(p.product.name)
    staleByRetailer.set(key, entry)
  }

  return NextResponse.json({
    stats,
    flags: {
      rescanned,
      stale: [...staleByRetailer.values()].map((e) => ({
        retailer: e.retailer,
        count: e.count,
        oldest: e.oldest,
        products: [...e.products],
      })),
      staleDays: STALE_DAYS,
    },
  })
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

  const result = generateSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { productId, quantity } = result.data
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const codes = generatePackCodes(quantity)
  try {
    await prisma.pack.createMany({
      data: codes.map((code) => ({
        code,
        productId,
        donationAmount: product.donationPerUnit,
      })),
    })
  } catch {
    // Negligible chance of a collision with an existing code — regenerate once.
    const retryCodes = generatePackCodes(quantity)
    await prisma.pack.createMany({
      data: retryCodes.map((code) => ({
        code,
        productId,
        donationAmount: product.donationPerUnit,
      })),
    })
  }

  const packs = await prisma.pack.findMany({
    where: { productId, dispatchId: null, status: 'in_warehouse' },
    orderBy: { createdAt: 'desc' },
    take: quantity,
    select: { code: true, status: true },
  })

  return NextResponse.json({ created: quantity, packs }, { status: 201 })
}

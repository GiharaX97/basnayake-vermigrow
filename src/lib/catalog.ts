import { prisma } from '@/lib/prisma'
import { ACTIVE_SALE_STATUSES } from '@/lib/orders'

/**
 * The public catalog, shared by the `/order` page (server-rendered) and
 * `GET /api/catalog` (used to refresh seat counts after an order). One query
 * implementation so the page and the endpoint can never disagree.
 */

export interface CatalogItem {
  id: string
  name: string
  kind: string
  price: number
  unit: string
  description: string
  imageUrl: string | null
  donationPerUnit: number
  eventDate: Date | null
  location: string | null
  capacity: number | null
  /** null = no seat limit. 0 = fully booked. */
  remainingSeats: number | null
  /** false when no price is set yet — shown as "Ask for price", not orderable. */
  orderable: boolean
}

export async function getCatalog(): Promise<CatalogItem[]> {
  const [products, committed] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      // Services after products, oldest first within each group, so the page
      // doesn't reshuffle as items are edited.
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        kind: true,
        price: true,
        unit: true,
        description: true,
        imageUrl: true,
        donationPerUnit: true,
        eventDate: true,
        location: true,
        capacity: true,
      },
    }),
    // Seats already committed, in one query rather than one per product.
    prisma.sale.groupBy({
      by: ['productId'],
      where: { status: { in: [...ACTIVE_SALE_STATUSES] } },
      _sum: { quantity: true },
    }),
  ])

  const takenBy = new Map(committed.map((c) => [c.productId, c._sum.quantity ?? 0]))

  return products.map((p) => {
    const taken = takenBy.get(p.id) ?? 0
    const isSeated = p.kind === 'service' && p.capacity !== null
    return {
      ...p,
      remainingSeats: isSeated ? Math.max(0, (p.capacity as number) - taken) : null,
      // A price of 0 means the farm hasn't set one yet, so the item cannot be
      // bought online — the card offers "Ask for price" instead. Enforced again
      // in POST /api/orders; this flag is for display.
      orderable: p.price > 0,
    }
  })
}

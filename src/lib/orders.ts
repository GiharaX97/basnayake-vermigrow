import { randomInt } from 'crypto'
import type { Prisma } from '@prisma/client'

/**
 * Shared rules for customer-placed online orders.
 *
 * Server-only: nothing here may be imported into a client component except the
 * plain constants, and `ONLINE_RETAILER` must NEVER be — it is the value written
 * to the required `Sale.retailer` column for online orders, and if the client
 * could supply it, a customer could impersonate a retailer's recorded sale.
 */

/**
 * `Sale.retailer` is required (see the schema comment: SQLite cannot drop
 * NOT NULL without rewriting the table on a live DB). Customer orders have no
 * retailer, so they write this sentinel instead. The real buyer is in the
 * `customer*` columns.
 */
export const ONLINE_RETAILER = 'Online store'

/** Same ambiguous-character-free alphabet as printed pack codes. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Groups the lines of one order. Deliberately NOT shaped like a pack code: the
 * `VG-O-` infix can never match `PACK_CODE_REGEX` (which is `VG-` + 6 chars), so
 * an order reference can never be mistaken for a scannable pack.
 */
export function generateOrderRef(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return `VG-O-${code}`
}

/** Caps on a single order, enforced server-side. The client mirrors them for UX only. */
export const MAX_ORDER_LINES = 10
export const MAX_PRODUCT_QTY = 50
export const MAX_SERVICE_QTY = 10

/** Statuses that hold seats / count as committed. */
export const ACTIVE_SALE_STATUSES = ['pending', 'paid'] as const

/**
 * Raised when an order would push a service past its seat limit.
 *
 * Typed rather than a generic Error so the route can answer 409 with a real
 * explanation ("only 1 seat left") instead of a 500. The invariant it protects —
 * a workshop is never overbooked — is what matters; the status code is how the
 * customer finds out why.
 */
export class CapacityError extends Error {
  constructor(
    readonly productId: string,
    readonly productName: string,
    readonly remaining: number
  ) {
    super(`Only ${remaining} seat(s) left for ${productName}`)
    this.name = 'CapacityError'
  }
}

/**
 * Seats already committed for a service, counting pending orders as taken.
 *
 * Pending orders hold their seats: an online order is a real customer waiting to
 * pay at the counter, so releasing the seat before the admin cancels would let
 * the same seat be sold twice. A pending order that is never paid is released by
 * an admin cancelling it (see the admin Orders tab).
 */
export async function seatsTaken(
  client: Prisma.TransactionClient,
  productId: string
): Promise<number> {
  const agg = await client.sale.aggregate({
    where: { productId, status: { in: [...ACTIVE_SALE_STATUSES] } },
    _sum: { quantity: true },
  })
  return agg._sum.quantity ?? 0
}

/**
 * Throw `CapacityError` unless `quantity` more units fit.
 *
 * MUST be called inside the same transaction that inserts the sale: the read and
 * the write have to be one atomic unit or two concurrent orders can both pass
 * this check and both commit, overbooking the workshop. On SQLite the loser of
 * that race may surface as SQLITE_BUSY/P2034 instead of a clean error — the
 * route handles that separately.
 */
export async function assertSeatsAvailable(
  client: Prisma.TransactionClient,
  product: { id: string; name: string; kind: string; capacity: number | null },
  quantity: number
): Promise<void> {
  // Only services have seats; a physical product's "capacity" is unbounded stock.
  if (product.kind !== 'service' || product.capacity === null) return

  const taken = await seatsTaken(client, product.id)
  const remaining = Math.max(0, product.capacity - taken)
  if (quantity > remaining) {
    throw new CapacityError(product.id, product.name, remaining)
  }
}

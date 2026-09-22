import { z } from 'zod'

/**
 * Validation for a catalog item (a product or a service), shared by the create
 * and update admin routes so the two can never drift apart — before this they
 * each declared their own copy of the fields.
 */

/**
 * A cleared date input sends `''`, which must mean "no date" rather than an
 * invalid Date. `z.coerce.date()` alone would turn `''` into `Invalid Date` and
 * reject a form the admin had simply emptied.
 */
const optionalDate = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : v),
  z.coerce.date().nullable()
)

/** Empty string from a form field means "not set", which is NULL in the DB. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? null : v),
    z.string().trim().max(max).nullable()
  )

const optionalCapacity = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : v),
  z.coerce.number().int('Must be a whole number').min(0, 'Must be >= 0').max(100000).nullable()
)

/**
 * The fields WITHOUT defaults. Defaults are applied by the create schema only —
 * see the warning on `productUpdateSchema` for why that separation is load-
 * bearing rather than stylistic.
 */
const base = {
  name: z.string().transform((v) => v.trim()).pipe(z.string().min(1, 'Name is required').max(120)),
  /**
   * 'product' or 'service' — a free String column, not a Prisma enum (enums are
   * unsupported on the SQLite connector). Changing this on an existing item is
   * allowed but meaningful: it flips the QR lifecycle from
   * in_warehouse→dispatched→sold to issued→redeemed.
   */
  kind: z.enum(['product', 'service']),
  /** LKR. 0 (or less) means "no price set yet" — the item is not orderable online. */
  price: z.coerce.number().min(0, 'Must be >= 0').max(10_000_000),
  unit: z.string().trim().max(24),
  description: z.string().trim().max(2000),
  imageUrl: optionalText(500),
  donationPerUnit: z.coerce.number().min(0, 'Must be >= 0').max(100000),
  eventDate: optionalDate,
  location: optionalText(120),
  /** Services only: null means unlimited seats. */
  capacity: optionalCapacity,
  active: z.boolean(),
}

/** Create: a new item needs sensible starting values for anything not supplied. */
export const productSchema = z.object({
  ...base,
  kind: base.kind.default('product'),
  price: base.price.default(0),
  unit: base.unit.default(''),
  description: base.description.default(''),
  donationPerUnit: base.donationPerUnit.default(20),
  active: base.active.default(true),
})

/**
 * Update: every field optional, and — critically — NO DEFAULTS ANYWHERE.
 *
 * A PATCH sends only what changed, and Prisma leaves an absent key alone. That
 * only holds if an absent key parses to `undefined`.
 *
 * This is NOT what `.partial()` alone gives you. Measured on zod 4.4.3:
 * `z.object({ price: z.coerce.number().default(0), kind: z.enum([...]).default('product') })
 * .partial().parse({ price: 350 })` returns
 * `{ price: 350, kind: 'product', unit: '', donationPerUnit: 20, active: true }`
 * — the defaults still fire. Since the admin route passes the parsed object
 * straight to `prisma.product.update`, writing the schema the obvious way would
 * mean that editing one price silently reset the item's description, unit,
 * donation rate, kind and active flag.
 *
 * Hence `base` carries no defaults, and only the create schema adds them.
 */
export const productUpdateSchema = z.object(base).partial()

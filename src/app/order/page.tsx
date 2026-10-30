import type { Metadata } from 'next'
import { getCatalog } from '@/lib/catalog'
import { OrderClient } from '@/components/site/order-client'
import { buildProductsJsonLd, serializeJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = {
  title: 'Order & Book — Basnayaka Vermigrow',
  description:
    'Order vermicompost and worms, or book a seat in our vermiculture workshops. Every item and every seat sends a share to Apeksha Hospital.',
  alternates: { canonical: '/order' },
}

/**
 * This page reads the database, so it must NOT be pre-rendered at build time.
 *
 * Without this, `next build` would bake the catalog and the seat counts into the
 * standalone bundle at deploy time — the page would then advertise a workshop
 * that filled up days ago and keep taking bookings for it. No other page in this
 * repo reads the DB during render, so there is no existing pattern to follow;
 * `force-dynamic` is the documented deviation.
 */
export const dynamic = 'force-dynamic'

export default async function OrderPage() {
  const items = await getCatalog()
  const origin = process.env.NEXTAUTH_URL || 'https://basnayakavermigrow.lk'
  // Null when nothing in the catalog has a price — markup for an unpriced item
  // would advertise it at LKR 0, which is not true.
  const productsJsonLd = buildProductsJsonLd(items, origin)

  return (
    <>
      {productsJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(productsJsonLd) }}
        />
      )}
      <OrderClient initialItems={items} />
    </>
  )
}

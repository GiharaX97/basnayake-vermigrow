import { NextResponse } from 'next/server'
import { getCatalog } from '@/lib/catalog'

/**
 * The public catalog: what the farm sells, and what is still bookable.
 *
 * This is the first public endpoint that reads live business data, so it must
 * never be pre-rendered into the build output — a cached seat count would keep
 * selling a workshop that filled up days ago. `force-dynamic` is the mechanism;
 * no other public page in this repo read the DB before, so it has no precedent.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await getCatalog()
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}

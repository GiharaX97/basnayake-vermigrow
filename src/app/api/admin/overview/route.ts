import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getAdminOverview } from '@/lib/admin-overview'

/**
 * The dashboard's data as JSON.
 *
 * The dashboard page itself is server-rendered from the same helper, so this
 * route is not on its critical path — it exists so the figures can be checked
 * (and reused) without opening the admin UI. `no-store`: a cached count is
 * worse than no count.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(await getAdminOverview(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

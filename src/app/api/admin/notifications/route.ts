import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getAdminNotifications } from '@/lib/admin-notifications'

/**
 * Everything waiting on an admin, in one call.
 *
 * The header bell polls this (every 60s while the tab is visible, and on
 * focus), so the response must stay small and the query bounded — the
 * aggregation itself is in src/lib/admin-notifications.ts, shared with the
 * dashboard overview route.
 *
 * `no-store` because a cached count is worse than no count: the whole point is
 * to see the pledge that arrived a minute ago.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary = await getAdminNotifications()
  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

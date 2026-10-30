import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientIp, createThrottle } from '@/lib/throttle'
import { deriveOrderStatus } from '@/lib/payments'

/**
 * The customer's own order state, for the page they land on after a card
 * payment. PUBLIC and read-only.
 *
 * It returns ONLY the status and total — no name, phone, email or receipt
 * token. The order reference is not a credential; it is already on the
 * customer's screen and in the text they were sent. The credential for the full
 * receipt stays `/r/<token>`.
 *
 * The browser return is never allowed to settle anything. It reads what the
 * webhook has already written; at worst it shows "still confirming" while the
 * signed event is in flight.
 */

const statusThrottle = createThrottle({ windowMs: 5 * 60 * 1000, max: 60 })
const statusGlobalThrottle = createThrottle({ windowMs: 5 * 60 * 1000, max: 600 })

export async function GET(request: Request) {
  const ip = clientIp(request)
  if (statusThrottle.check(ip) || statusGlobalThrottle.check('global')) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const ref = new URL(request.url).searchParams.get('ref')?.trim() ?? ''
  if (!/^VG-O-[A-Z0-9]{6}$/.test(ref)) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  const lines = await prisma.sale.findMany({
    where: { orderRef: ref },
    select: { status: true, unitPrice: true, quantity: true },
  })
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  const status = deriveOrderStatus(lines.map((l) => l.status))
  const total = lines
    .filter((l) => l.status !== 'cancelled')
    .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  return NextResponse.json(
    { orderRef: ref, status, total },
    { headers: { 'Cache-Control': 'no-store, private' } }
  )
}

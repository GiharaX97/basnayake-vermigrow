import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { OrderStateError } from '@/lib/payments'
import { orderStatusSchema } from '@/lib/fulfilment'
import { addNote, dismissCancelRequest, setStageTx } from '@/lib/order-actions'
import { autoDeliver } from '@/lib/notify'

/**
 * Move an order by hand: along the fulfilment pipeline, or onto the record as a
 * note, or off the cancel-request flag.
 *
 * Money is NOT touched here. Payment is the settle route's job, and keeping the
 * two apart is what stops "packed" from ever moving a donation into the public
 * fund. The only state this route writes is `Sale.fulfillment` plus the
 * `OrderEvent` timeline entry that explains it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderRef: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { orderRef } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = orderStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const exists = await prisma.sale.count({ where: { orderRef } })
  if (exists === 0) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  try {
    if (parsed.data.action === 'note') {
      await addNote(prisma, { orderRef, note: parsed.data.note })
      return NextResponse.json({ success: true, action: 'note', orderRef })
    }

    if (parsed.data.action === 'dismiss_cancel_request') {
      await dismissCancelRequest(prisma, { orderRef, note: parsed.data.note })
      return NextResponse.json({ success: true, action: 'dismiss_cancel_request', orderRef })
    }

    const { stage, note } = parsed.data
    const result = await prisma.$transaction((tx) =>
      setStageTx(tx, { orderRef, stage, actor: 'admin', note })
    )

    // After the commit — a gateway must never hold the order's write lock, and a
    // send failure must not undo a status the admin has already been told stuck.
    // Drains the record's queue oldest-first, so an order placed online still
    // tells a coherent story. See autoDeliver.
    const delivery = await autoDeliver(prisma, 'order', orderRef)

    return NextResponse.json({
      success: true,
      action: 'set_stage',
      orderRef,
      from: result.from,
      to: result.to,
      lines: result.lines,
      message: result.message,
      delivery,
    })
  } catch (err) {
    if (err instanceof OrderStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not update this order' }, { status: 500 })
  }
}

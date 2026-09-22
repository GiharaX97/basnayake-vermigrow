import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { deliverMessage, revokeLink } from '@/lib/notify'
import { z } from 'zod'

/**
 * Do something with one queued message.
 *
 * `send`   — transmit (http transport) or record a hand-sent message (manual).
 * `skip`   — decide not to send it. The row stays, so the record still shows
 *            that this customer was never told.
 * `revoke` — kill the receipt link behind this message.
 *
 * `sentBy` is NOT taken from the request body — a client-supplied value would
 * make the record worthless. It is the literal 'admin', because this app has one
 * shared admin login and no per-person identity exists to record. If a second
 * admin account is ever added, resolve the sender from the session here.
 */

const actionSchema = z.object({
  action: z.enum(['send', 'skip', 'revoke']),
})

const SENT_BY = 'admin'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const message = await prisma.customerMessage.findUnique({
    where: { id },
    select: { id: true, status: true, linkId: true },
  })
  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (parsed.data.action === 'revoke') {
    await revokeLink(prisma, message.linkId)
    return NextResponse.json({ success: true, action: 'revoke' })
  }

  if (parsed.data.action === 'skip') {
    // Conditional: only a queued message can be skipped, so this can never flip
    // an already-sent row — the same at-most-once shape as the ledger.
    const claimed = await prisma.customerMessage.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'skipped' },
    })
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: 'This message has already been sent or skipped.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: true, action: 'skip' })
  }

  const result = await deliverMessage(prisma, id, SENT_BY)
  if (!result.ok) {
    // `already` is a conflict, not a failure: two admins tapped Send, one won.
    return NextResponse.json(
      { error: result.error ?? 'Could not send' },
      { status: result.already ? 409 : 502 }
    )
  }
  return NextResponse.json({ success: true, action: 'send' })
}

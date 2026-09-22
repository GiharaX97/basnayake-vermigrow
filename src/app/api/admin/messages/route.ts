import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { activeTransport } from '@/lib/notify'

/**
 * The outbox. Everything we owe a customer, whatever produced it.
 *
 * Read-only — sending and skipping are per-message actions in ./[id]. This is
 * the endpoint behind the Messages tab on /admin/donations.
 */

/** Matches the take: 200 used by the sales and payments lists. */
const MESSAGE_LIMIT = 200

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [messages, queuedCount, failedCount] = await Promise.all([
    prisma.customerMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_LIMIT,
      include: {
        link: {
          select: {
            id: true,
            refType: true,
            refId: true,
            token: true,
            expiresAt: true,
            revokedAt: true,
          },
        },
      },
    }),
    prisma.customerMessage.count({ where: { status: 'queued' } }),
    prisma.customerMessage.count({ where: { status: 'failed' } }),
  ])

  // The transport is reported so the UI can tell the admin whether tapping Send
  // will actually transmit anything or merely record what they did by hand.
  // A UI that assumed "http" would silently mark messages sent without sending.
  return NextResponse.json({
    messages,
    queuedCount,
    failedCount,
    transport: activeTransport(),
  })
}

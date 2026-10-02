import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import {
  activeTransport,
  autoSentToday,
  autoSendEnabled,
  deliverMessage,
  smsDailyCap,
} from '@/lib/notify'
import { providerStatus } from '@/lib/sms'

/**
 * The outbox. Everything we owe a customer, whatever produced it.
 *
 * GET is the list behind the Messages tab on /admin/donations. POST is the
 * bulk send — sending and skipping ONE message stays in ./[id].
 */

/** Matches the take: 200 used by the sales and payments lists. */
const MESSAGE_LIMIT = 200

/** One click sends at most this many. See the POST handler. */
const BULK_LIMIT = 50

const SENT_BY = 'admin'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [messages, queuedCount, failedCount, sentToday] = await Promise.all([
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
    autoSentToday(prisma),
  ])

  // The transport is reported so the UI can tell the admin whether tapping Send
  // will actually transmit anything or merely record what they did by hand.
  // A UI that assumed "http" would silently mark messages sent without sending.
  //
  // `provider` adds the detail that answer needs in order to be actionable: not
  // just "a gateway is configured" but WHICH one, and which of its credentials
  // are missing. It names variables and whether they are set — never a value.
  return NextResponse.json({
    messages,
    queuedCount,
    failedCount,
    transport: activeTransport(),
    provider: providerStatus(),
    autoSend: {
      enabled: autoSendEnabled(),
      cap: smsDailyCap(),
      sentToday,
    },
  })
}

/**
 * Send every queued message, oldest first.
 *
 * This is the human override for everything autoDeliver held back — past the
 * daily cap, queued while no gateway was configured, or left after a failure.
 * It is deliberately NOT subject to SMS_DAILY_CAP: that cap exists to bound what
 * the software spends on its own initiative, and a person looking at the list and
 * pressing Send is precisely the judgement the cap stands in for.
 *
 * It IS bounded by BULK_LIMIT, because one click should not be able to commit an
 * unbounded amount of money by accident. The response reports what is left, so a
 * large backlog clears in visible steps rather than one blind sweep.
 *
 * REFUSED ENTIRELY ON THE MANUAL TRANSPORT. There, deliverMessage records a
 * hand-sent message without transmitting — correct for one message an admin has
 * actually sent from their phone, and catastrophic in bulk: one click would mark
 * the whole queue "sent" while every customer received nothing.
 */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (activeTransport() === 'manual') {
    return NextResponse.json(
      {
        error:
          'No SMS gateway is configured, so there is nothing to send. Send these from your phone and mark them sent one at a time.',
      },
      { status: 400 }
    )
  }

  const queued = await prisma.customerMessage.findMany({
    where: { status: 'queued', toPhone: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: BULK_LIMIT,
    select: { id: true },
  })

  let sent = 0
  let failed = 0

  for (const message of queued) {
    const result = await deliverMessage(prisma, message.id, SENT_BY)
    // `already` means someone else got there first — neither a send nor a failure.
    if (result.ok) sent++
    else if (!result.already) failed++
  }

  const remaining = await prisma.customerMessage.count({
    where: { status: 'queued', toPhone: { not: null } },
  })

  return NextResponse.json({ success: true, sent, failed, remaining })
}

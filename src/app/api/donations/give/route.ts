import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clientIp, createThrottle } from '@/lib/throttle'
import { optionalPhone } from '@/lib/notify'
import { z } from 'zod'

/**
 * Donate without buying a pack.
 *
 * This creates a PLEDGE, not money. The site cannot take card payments today
 * (Payments.lk is not enabled in production), so the honest shape is:
 *
 *   public form → Donation(status='pending') → admin confirms on the phone /
 *   sees the transfer → PATCH /api/admin/donations/<id> {action:'receive'}
 *
 * A pending row writes no FundEntry, no Payment, no wall entry and no SMS, so a
 * stranger cannot inflate the public total or spend the farm's SMS credit by
 * submitting the form. The throttle only bounds database noise.
 */

const giveThrottle = createThrottle({ windowMs: 30 * 60 * 1000, max: 5 })

const giveSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than 0')
    .max(10_000_000, 'That amount is too large'),
  name: z
    .string()
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(2, 'Name is too short').max(60, 'Name is too long')),
  phone: optionalPhone,
  note: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(300, 'Note is too long'))
    .optional()
    .default(''),
})

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (giveThrottle.check(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = giveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { amount, name, phone, note } = parsed.data

  const donation = await prisma.donation.create({
    data: {
      amount,
      // 'other' records that this was a web pledge; the admin replaces it with
      // the real method (cash/bank/card) when confirming.
      method: 'other',
      donorName: name,
      donorPhone: phone,
      note: note || 'Pledged from the website',
      status: 'pending',
    },
    select: { id: true, amount: true, status: true },
  })

  return NextResponse.json(
    {
      ...donation,
      message:
        'Thank you! Your pledge is with us. We will call you to arrange payment — nothing has been charged online.',
    },
    { status: 201 }
  )
}

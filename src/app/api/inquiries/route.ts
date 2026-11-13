import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { createThrottle, clientIp } from '@/lib/throttle'
import { z } from 'zod'

/**
 * The contact form is public and writes a row to the database, so without a cap
 * one script can fill the inquiries table (and the admin notification bell)
 * from a single address. Five messages per IP per ten minutes is well above what
 * a real visitor sends and cheap to keep in memory.
 */
const inquiryThrottle = createThrottle({ windowMs: 10 * 60 * 1000, max: 5 })

const inquirySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(320),
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
})

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const inquiries = await prisma.inquiry.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(inquiries)
}

export async function POST(request: Request) {
  if (inquiryThrottle.check(clientIp(request))) {
    return NextResponse.json(
      { error: 'Too many messages from this connection. Please try again later, or call us.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    )
  }

  // Parse and validate input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = inquirySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { name, email, message } = result.data
  const inquiry = await prisma.inquiry.create({ data: { name, email, message } })
  return NextResponse.json(inquiry, { status: 201 })
}

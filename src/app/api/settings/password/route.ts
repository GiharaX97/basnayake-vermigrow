import { NextResponse } from 'next/server'
import { isAdminAuthenticated, updatePassword, seedAdminPassword } from '@/lib/admin-auth'
import { z } from 'zod'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(128),
})

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = passwordSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten().fieldErrors?.newPassword?.[0] || 'Validation failed' },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = result.data

  const success = await updatePassword(currentPassword, newPassword)
  if (!success) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

/**
 * Seed endpoint — call GET /api/settings/password to initialize the admin password hash.
 * This is idempotent and safe to call at deploy time.
 */
export async function GET() {
  await seedAdminPassword()
  return NextResponse.json({ success: true, message: 'Admin password seeded' })
}

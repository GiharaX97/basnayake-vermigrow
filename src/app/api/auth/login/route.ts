import { NextResponse } from 'next/server'
import { setAdminCookie, checkPassword } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const { password } = await request.json()
  const valid = await checkPassword(password)
  if (valid) {
    await setAdminCookie()
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}

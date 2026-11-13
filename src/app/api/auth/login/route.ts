import { NextResponse } from 'next/server'
import { setAdminCookie, checkPassword } from '@/lib/admin-auth'
import { createThrottle, clientIp } from '@/lib/throttle'

/**
 * Brute-force guard. One failed password attempt is cheap for an attacker and
 * expensive for us (a bcrypt compare), and there is a single shared admin
 * password, so an unthrottled endpoint is the weakest link on the site.
 *
 * Twenty attempts per IP per fifteen minutes. Successful sign-ins count too:
 * an office on one NAT address has no reason to log in twenty times a quarter
 * hour, and keeping one rule is easier to reason about than a failure-only
 * counter that an attacker can game by succeeding once.
 */
const loginThrottle = createThrottle({ windowMs: 15 * 60 * 1000, max: 20 })

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (loginThrottle.check(ip)) {
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    )
  }

  let password: unknown
  try {
    const body = await request.json()
    password = body?.password
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const valid = await checkPassword(password)
  if (valid) {
    await setAdminCookie()
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}

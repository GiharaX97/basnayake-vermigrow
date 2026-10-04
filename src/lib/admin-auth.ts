import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'

const ADMIN_COOKIE = 'admin_session'
const PASSWORD_KEY = 'admin:password'
const SESSION_DURATION = 60 * 60 * 24 // 24 hours

/**
 * Generate a cryptographically random session token.
 */
function generateSessionToken(): string {
  return randomBytes(48).toString('hex')
}

/**
 * The DB key for a session: `session:<sha256 of the token>`.
 *
 * The token is hashed so a leaked database does not hand over live sessions —
 * the same property the previous bcrypt scheme had. What is different is the
 * HASH, and the difference matters:
 *
 *   bcrypt is deliberately slow because it defends a low-entropy secret a human
 *   chose. This token is 48 random bytes (384 bits) — there is nothing to guess
 *   and no rainbow table to build — so the slow hash bought no security here
 *   while costing ~80ms per comparison.
 *
 * The old scheme stored `session:<bcrypt hash>` and, finding a bcrypt hash
 * un-indexable, verified the cookie by comparing it against EVERY session row
 * until one matched. That made authentication O(sessions): with 39 rows lying
 * around it took ~3 seconds per request, every admin tab fired several requests,
 * and the table only ever grew — every login added a row and nothing removed
 * them. Measured at 2957ms/3004ms/2998ms for a single /api/admin/orders call.
 *
 * Keying on a deterministic digest makes the lookup one indexed equality match:
 * no bcrypt, no scan, and constant regardless of how many sessions exist.
 */
function sessionKey(token: string): string {
  return `session:${createHash('sha256').update(token).digest('hex')}`
}

/** A key written by the current scheme: 64 lowercase hex characters. */
const CURRENT_KEY_FORMAT = /^session:[0-9a-f]{64}$/

export async function setAdminCookie() {
  const token = generateSessionToken()
  const expiry = String(Date.now() + SESSION_DURATION * 1000)

  // Store session in DB
  await prisma.siteContent.upsert({
    where: { key: sessionKey(token) },
    create: { key: sessionKey(token), value: expiry },
    update: { value: expiry },
  })

  // Logging in is the one moment we know the table is being written, and it is
  // rare — so it is the right place to sweep. Best-effort: a failure here must
  // never cost someone their login.
  await pruneStaleSessions()

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    // Mark Secure only when we are actually behind HTTPS (NEXTAUTH_URL is the
    // public URL). Not tied to NODE_ENV: on the IP-only staging phase the site
    // is served over plain HTTP, and a Secure cookie would never be sent back.
    secure: (process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  })
}

export async function clearAdminCookie() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (token) {
    try {
      await prisma.siteContent.delete({ where: { key: sessionKey(token) } })
    } catch {
      // Session already expired or cleaned up
    }
  }
  cookieStore.delete(ADMIN_COOKIE)
}

/**
 * Delete session rows that can no longer authenticate anyone.
 *
 * Two kinds qualify, and both are dead weight:
 *
 *  - **Expired** — past their timestamp. The old code only ever removed the one
 *    row it happened to match, so they piled up (26 of 39 in the DB that exposed
 *    this).
 *  - **Legacy-format** — keys written by the old bcrypt scheme. Under the new
 *    key scheme they can never match a cookie again, so keeping them would be
 *    pure clutter. Recognising them by shape is what lets this run without a
 *    migration script.
 *
 * This is deliberately NOT on the authentication path. Authentication is a
 * single indexed lookup now; sweeping on every request would put the scan back.
 */
async function pruneStaleSessions(): Promise<void> {
  try {
    const rows = await prisma.siteContent.findMany({
      where: { key: { startsWith: 'session:' } },
      select: { key: true, value: true },
    })
    const now = Date.now()
    const stale = rows
      .filter((row) => !CURRENT_KEY_FORMAT.test(row.key) || !(parseInt(row.value, 10) > now))
      .map((row) => row.key)

    if (stale.length) {
      await prisma.siteContent.deleteMany({ where: { key: { in: stale } } })
    }
  } catch {
    // Housekeeping must never break a login.
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token) return false

  // ONE indexed lookup. No bcrypt, no scan — see sessionKey() for why the old
  // version cost seconds per request and this costs nothing.
  try {
    const session = await prisma.siteContent.findUnique({ where: { key: sessionKey(token) } })
    if (!session) return false

    if (Date.now() < parseInt(session.value, 10)) return true

    // Expired — remove it so the row does not linger until the next login.
    await prisma.siteContent.delete({ where: { key: session.key } }).catch(() => {})
    return false
  } catch {
    return false
  }
}

export async function checkPassword(password: string): Promise<boolean> {
  if (!password || password.length < 4) return false

  // 1. The DB-stored hashed password is the source of truth once seeded.
  //    We deliberately do NOT also accept the ADMIN_PASSWORD env value here:
  //    otherwise changing the password in the Admin panel would never revoke
  //    the old/env password (a silent backdoor). env is only a *seed* value.
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: PASSWORD_KEY } })
    if (row) {
      return bcrypt.compare(password, row.value)
    }
  } catch {
    // DB not available yet
  }

  // 2. Before any hash exists (first deploy), allow the env-seeded password.
  const envPw = process.env.ADMIN_PASSWORD
  return !!(envPw && password === envPw)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function updatePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  const valid = await checkPassword(oldPassword)
  if (!valid) return false

  const hashed = await hashPassword(newPassword)
  await prisma.siteContent.upsert({
    where: { key: PASSWORD_KEY },
    create: { key: PASSWORD_KEY, value: hashed },
    update: { value: hashed },
  })
  return true
}

export async function getAdminPassword(): Promise<string> {
  // Read the stored hash (or return the env var as raw before seeding)
  const envPw = process.env.ADMIN_PASSWORD
  if (envPw) return envPw

  try {
    const row = await prisma.siteContent.findUnique({ where: { key: PASSWORD_KEY } })
    if (row) return row.value
  } catch {
    // ignore
  }

  return ''
}

/**
 * Seed the admin password hash into the DB if not already set.
 * Called on first deploy.
 */
export async function seedAdminPassword(): Promise<void> {
  const existing = await prisma.siteContent.findUnique({ where: { key: PASSWORD_KEY } })
  if (!existing) {
    // Seed from the env var only — no hardcoded default password.
    const envPw = process.env.ADMIN_PASSWORD
    if (!envPw) return
    const hashed = await hashPassword(envPw)
    await prisma.siteContent.upsert({
      where: { key: PASSWORD_KEY },
      create: { key: PASSWORD_KEY, value: hashed },
      update: { value: hashed },
    })
  }
}

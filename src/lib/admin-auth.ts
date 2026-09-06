import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

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
 * Store a session token (hashed) alongside its expiry.
 * We store it in SiteContent for simplicity, keyed by a session prefix + token hash.
 */
function sessionKey(tokenHash: string): string {
  return `session:${tokenHash}`
}

export async function setAdminCookie() {
  const token = generateSessionToken()
  const hash = await bcrypt.hash(token, 10)

  // Store session in DB
  await prisma.siteContent.upsert({
    where: { key: sessionKey(hash) },
    create: { key: sessionKey(hash), value: String(Date.now() + SESSION_DURATION * 1000) },
    update: { value: String(Date.now() + SESSION_DURATION * 1000) },
  })

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
    const hash = await bcrypt.hash(token, 10)
    try {
      await prisma.siteContent.delete({ where: { key: sessionKey(hash) } })
    } catch {
      // Session already expired or cleaned up
    }
  }
  cookieStore.delete(ADMIN_COOKIE)
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token) return false

  // We can't enumerate sessions easily with SQLite, so we check against recent sessions
  // by trying to verify. For simplicity, we hash the token and look it up.
  // A more scalable approach would store sessions in a dedicated table.
  try {
    const sessions = await prisma.siteContent.findMany({
      where: { key: { startsWith: 'session:' } },
    })
    for (const session of sessions) {
      const match = await bcrypt.compare(token, session.key.replace('session:', ''))
      if (match) {
        const expiry = parseInt(session.value, 10)
        if (Date.now() < expiry) return true
        // Expired session — clean up
        await prisma.siteContent.delete({ where: { key: session.key } }).catch(() => {})
        return false
      }
    }
  } catch {
    return false
  }
  return false
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

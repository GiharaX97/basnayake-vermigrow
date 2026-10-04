import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify the JWT that httpSMS puts in the `Authorization: Bearer …` header.
 *
 * Hand-rolled with node:crypto rather than pulling in a JWT library. This project
 * deliberately pruned its dependencies, and the whole job is: split on dots, HMAC
 * one string, compare two buffers, read two timestamps. `jsonwebtoken` would add
 * a dependency, a transitive tree and a CVE feed to a farm's website in exchange
 * for about forty lines.
 *
 * WHAT IS DELIBERATELY NOT SUPPORTED, and why each refusal is the safe direction:
 *
 *  - **Only HS256.** The algorithm is read from the token's own header, which is
 *    attacker-controlled, so trusting it is the classic `alg: none` / RS256→HS256
 *    confusion bug. Anything that is not exactly HS256 is rejected outright rather
 *    than passed to some generic verifier.
 *  - **No `aud`/`iss` check.** They are not part of the documented httpSMS
 *    contract, and inventing a value to compare against would produce a check that
 *    silently never matches — worse than no check, because it looks like one.
 *  - **No key rotation.** One signing key, from the environment.
 *
 * The comparison is constant-time. A byte-by-byte early exit on a signature check
 * leaks how much of a guess was correct, which is enough to forge one a byte at a
 * time.
 */

export interface VerifiedToken {
  ok: boolean
  payload?: Record<string, unknown>
  error?: string
}

/** Clock skew allowance. A phone's clock, and a server's, are not the same clock. */
const LEEWAY_SECONDS = 60

export function verifyHs256Jwt(
  token: string,
  secret: string,
  { leewaySeconds = LEEWAY_SECONDS, now = Date.now() }: { leewaySeconds?: number; now?: number } = {}
): VerifiedToken {
  if (!secret) return { ok: false, error: 'no signing key configured' }

  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, error: 'not a JWT' }
  const [headerB64, payloadB64, signatureB64] = parts

  let header: { alg?: unknown; typ?: unknown }
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'header is not JSON' }
  }
  if (header?.alg !== 'HS256') {
    // `alg: none` lands here too, which is the point.
    return { ok: false, error: `unsupported algorithm ${String(header?.alg)}` }
  }

  const expected = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest()
  const given = Buffer.from(signatureB64, 'base64url')
  // Length first: timingSafeEqual throws on a length mismatch, and a thrown
  // comparison is a louder failure than a false one.
  if (given.length !== expected.length) return { ok: false, error: 'signature mismatch' }
  if (!timingSafeEqual(given, expected)) return { ok: false, error: 'signature mismatch' }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'payload is not JSON' }
  }

  const seconds = Math.floor(now / 1000)
  const exp = typeof payload.exp === 'number' ? payload.exp : null
  if (exp !== null && exp + leewaySeconds < seconds) {
    return { ok: false, error: 'token expired' }
  }
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null
  if (nbf !== null && nbf - leewaySeconds > seconds) {
    return { ok: false, error: 'token not yet valid' }
  }

  // The signature is valid and the times are sane. From here the PAYLOAD IS DATA,
  // not instructions — it is attacker-shaped input that merely happens to be
  // authentic, and nothing in this file acts on its contents.
  return { ok: true, payload }
}

/**
 * Pull the bearer token out of an Authorization header, or null.
 *
 * Case-insensitive on the scheme: RFC 6750 says the scheme is case-insensitive,
 * and a gateway that sends `bearer` is not a gateway we should reject.
 */
export function bearerToken(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1]!.trim() : null
}

/** The environment variable holding the httpSMS webhook signing key. */
export const WEBHOOK_SECRET_ENV = 'HTTPSMS_WEBHOOK_SECRET'

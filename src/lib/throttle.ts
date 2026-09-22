/**
 * In-memory per-key request throttle.
 *
 * Single-instance standalone server, so an in-process Map is sufficient — same
 * assumption the two hand-rolled copies in `/api/donations` and
 * `/api/donations/scan` already made. This replaces them so new public
 * endpoints don't grow a third and fourth copy.
 *
 * Behaviour note: a *rejected* attempt is not recorded. A client that keeps
 * hammering stays blocked until its recorded hits age out of the window, rather
 * than extending its own block indefinitely. The scan route previously recorded
 * rejected hits; this standardises on the `/api/donations` behaviour.
 */

/** Cap on tracked keys, so a flood of unique IPs can't grow the Map forever. */
const DEFAULT_MAX_KEYS = 5000

export interface ThrottleOptions {
  /** Sliding window length in ms. */
  windowMs: number
  /** Max accepted attempts per key per window. */
  max: number
  /** Hard cap on distinct keys held; oldest are evicted past this. */
  maxKeys?: number
}

export interface Throttle {
  /** Returns true when the key has exhausted its allowance. */
  check(key: string): boolean
  /** Drop all state (tests only). */
  reset(): void
}

/** First hop of `x-forwarded-for`, else a shared bucket. Spoofable — see note. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}

export function createThrottle({
  windowMs,
  max,
  maxKeys = DEFAULT_MAX_KEYS,
}: ThrottleOptions): Throttle {
  const hits = new Map<string, number[]>()

  // Only runs once the Map is over capacity, which is rare — so the O(n) sweep
  // is amortised rather than paid on every request.
  function evict(now: number) {
    for (const [key, times] of hits) {
      if (hits.size <= maxKeys) return
      if (times.every((t) => now - t >= windowMs)) hits.delete(key)
    }
    // Nothing left to expire: drop oldest by insertion order.
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next().value
      if (oldest === undefined) break
      hits.delete(oldest)
    }
  }

  return {
    check(key: string): boolean {
      const now = Date.now()
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)

      if (recent.length >= max) {
        hits.set(key, recent)
        return true
      }

      recent.push(now)
      hits.set(key, recent)

      if (hits.size > maxKeys) evict(now)
      return false
    },
    reset() {
      hits.clear()
    },
  }
}

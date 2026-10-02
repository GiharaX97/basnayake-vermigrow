/**
 * Shared POST helper for the HTTP providers.
 *
 * The 10-second timeout is the important part. This runs on a request path a
 * customer is waiting on, and a gateway that accepts a connection and then hangs
 * must not hang the order confirmation with it. A timeout surfaces as
 * `{ ok: false, error: 'timed out' }`, which marks the message failed and
 * leaves it visible in the admin rather than silently pending forever.
 *
 * Never throws, for the same reason: the caller records failure, it does not
 * propagate.
 */
export interface HttpResponse {
  ok: boolean
  status: number
  /** Parsed JSON body when the response was JSON, otherwise null. */
  json: unknown
  /** Raw text, truncated — enough for an error message, not enough to bloat the DB. */
  text: string
}

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 10_000
): Promise<HttpResponse> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text().catch(() => '')
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      // A non-JSON body is common for gateway errors (an HTML 502 page). The
      // raw text is kept so the admin sees something more useful than "failed".
    }
    return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'request failed'
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return { ok: false, status: 0, json: null, text: timedOut ? 'timed out' : message }
  }
}

/** Pull a human-readable message out of whatever shape the gateway returned. */
export function errorText(res: HttpResponse): string {
  const j = res.json as { message?: unknown; error?: unknown; description?: unknown } | null
  const fromJson =
    (typeof j?.message === 'string' && j.message) ||
    (typeof j?.error === 'string' && j.error) ||
    (typeof j?.description === 'string' && j.description)
  if (fromJson) return fromJson
  if (res.status === 0) return res.text || 'network error'
  return `${res.status}${res.text ? ` ${res.text}` : ''}`.trim()
}

/** Missing-credential errors read better naming the exact variables to set. */
export function missingEnv(vars: string[]): string {
  return `SMS provider not configured — set ${vars.join(', ')}`
}

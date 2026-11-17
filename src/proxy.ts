import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Per-request Content Security Policy.
 *
 * The policy used to live in `next.config.ts` with `'unsafe-inline'` in
 * `script-src`, because Next's bootstrap scripts are written inline and a static
 * header cannot carry a per-response nonce. Generating the nonce here instead
 * lets `script-src` drop `'unsafe-inline'`: Next reads the `Content-Security-Policy`
 * request header below and stamps the nonce onto every script it emits, so only
 * inline code that carries the nonce runs. An injected `<script>` cannot guess it.
 *
 * `style-src` keeps `'unsafe-inline'` — Radix and Leaflet set element styles from
 * JavaScript, and the scripts are the injection path that matters.
 *
 * Only enabled in production: `next dev` compiles with eval and talks over a
 * websocket, which a strict policy would break without protecting anything.
 */
const cspEnabled = process.env.NODE_ENV === 'production'

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "media-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = cspEnabled ? buildCsp(nonce) : null

  // Admin writes must come from our own pages. The session cookie is
  // `sameSite=lax`, which already stops a cross-site page from carrying it, but
  // a stranded admin tab on another origin is still the classic way to drive a
  // signed-in session. Browsers tell us where a request came from; a request
  // with neither header is a script or curl, which is not the threat here.
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    const method = request.method
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const site = request.headers.get('sec-fetch-site')
      let sameOrigin = true
      if (site) {
        sameOrigin = site === 'same-origin' || site === 'none'
      } else {
        const origin = request.headers.get('origin')
        if (origin) {
          try {
            sameOrigin = new URL(origin).host === request.headers.get('host')
          } catch {
            sameOrigin = false
          }
        }
      }
      if (!sameOrigin) {
        return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 })
      }
    }
  }

  const requestHeaders = new Headers(request.headers)
  if (csp) {
    requestHeaders.set('x-nonce', nonce)
    // Next parses this header during rendering and applies the nonce to its own
    // scripts. It is also the value sent back to the browser below.
    requestHeaders.set('Content-Security-Policy', csp)
  }

  // Customer receipts are personal data on a public URL. next.config.ts sets
  // no-store for /r/*, but Next's own render pipeline overwrites Cache-Control
  // on a dynamic page response (measured — the config value is replaced, while
  // X-Robots-Tag and Referrer-Policy from the same block survive). Setting it
  // here, on the response object, is what actually reaches the client.
  if (pathname.startsWith('/r/')) {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Cache-Control', 'no-store, private')
    if (csp) response.headers.set('Content-Security-Policy', csp)
    return response
  }

  // Protect all /admin routes except login
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const session = request.cookies.get('admin_session')
    if (!session?.value || session.value.length < 20) {
      // Redirect to login — no valid session token present
      const loginUrl = new URL('/admin/login', request.url)
      // Preserve the original destination as a redirect param
      if (pathname !== '/admin' && pathname !== '/admin/') {
        loginUrl.searchParams.set('redirect', pathname)
      }
      const response = NextResponse.redirect(loginUrl)
      if (csp) response.headers.set('Content-Security-Policy', csp)
      return response
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (csp) response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Every page (so it can carry a nonce) plus the admin API, whose cross-site
  // guard lives above. Static assets, the API, and the security.txt route are
  // excluded — none of them renders HTML that needs a nonce.
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|images|logos|uploads|robots\\.txt|sitemap\\.xml|site\\.webmanifest|\\.well-known).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    '/api/admin/:path*',
  ],
}

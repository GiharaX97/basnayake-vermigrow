import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // Customer receipts are personal data on a public URL. next.config.ts sets
  // no-store for /r/*, but Next's own render pipeline overwrites Cache-Control
  // on a dynamic page response (measured — the config value is replaced, while
  // X-Robots-Tag and Referrer-Policy from the same block survive). Setting it
  // here, on the response object, is what actually reaches the client.
  if (pathname.startsWith('/r/')) {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'no-store, private')
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
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/r/:path*', '/api/admin/:path*'],
}

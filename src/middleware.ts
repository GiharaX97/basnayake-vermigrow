import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/admin/:path*', '/r/:path*'],
}

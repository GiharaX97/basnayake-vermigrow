import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/admin/:path*'],
}

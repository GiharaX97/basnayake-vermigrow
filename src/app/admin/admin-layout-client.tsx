'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  ArrowLeft,
  Leaf,
  MessageSquare,
  Image,
  ChevronRight,
  HeartHandshake,
  Warehouse,
  Package,
  ClipboardList,
} from 'lucide-react'

/**
 * `short` is what the mobile bottom nav renders. That bar divides the full width
 * between its items with no wrapping, and Orders took it to NINE — roughly 40px
 * per item at a 360px viewport. Every other label was shortened to fit that width
 * (Warehouse → "Stock", Inquiries → "Inquiry") rather than dropping a destination
 * from the phone, because an admin out at the workshop is exactly the person who
 * needs to open an order and mark it paid.
 */
const navItems = [
  { href: '/admin', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', short: 'Orders', icon: ClipboardList },
  { href: '/admin/content', label: 'Content Editor', short: 'Content', icon: FileText },
  { href: '/admin/warehouse', label: 'Warehouse', short: 'Stock', icon: Warehouse },
  { href: '/admin/catalog', label: 'Catalog', short: 'Catalog', icon: Package },
  { href: '/admin/donations', label: 'Donations', short: 'Donations', icon: HeartHandshake },
  { href: '/admin/inquiries', label: 'Inquiries', short: 'Inquiry', icon: MessageSquare },
  { href: '/admin/media', label: 'Media Library', short: 'Media', icon: Image },
  { href: '/admin/settings', label: 'Settings', short: 'Settings', icon: Settings },
]

const breadcrumbLabels: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/orders': 'Orders',
  '/admin/content': 'Content Editor',
  '/admin/warehouse': 'Warehouse',
  '/admin/catalog': 'Catalog',
  '/admin/donations': 'Donations',
  '/admin/inquiries': 'Inquiries',
  '/admin/media': 'Media Library',
  '/admin/settings': 'Settings',
}

/**
 * The label for whatever `/admin/...` page is open.
 *
 * Exact matches win. Otherwise the LONGEST section prefix wins, so
 * `/admin/orders/ORD-1234` reads "Orders" — and a hypothetical
 * `/admin/orders/archive` would not be mislabelled by a shorter unrelated match.
 */
function labelFor(pathname: string): string {
  const exact = breadcrumbLabels[pathname]
  if (exact) return exact

  const prefix = Object.entries(breadcrumbLabels)
    .filter(([href]) => href !== '/admin' && pathname.startsWith(`${href}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]
  return prefix?.[1] ?? 'Admin'
}

/**
 * Whether a nav item is the section the admin is currently in.
 *
 * A prefix match, not equality, so opening one order keeps "Orders" highlighted.
 * `/admin` is excluded from prefix matching — it prefixes every other route, and
 * "Home" must not light up while the admin is in Settings.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const currentLabel = labelFor(pathname)

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="w-64 bg-card border-r shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b">
          <Link href="/admin" className="flex items-center gap-2.5 font-semibold text-lg">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <span className="text-foreground/90">Admin Panel</span>
          </Link>
          <p className="text-[11px] text-muted-foreground mt-1 ml-0.5">Basnayaka Vermigrow CMS</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                  {item.label}
                  {active && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </div>
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t space-y-1">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              View Site
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-destructive/70 hover:text-destructive hover:bg-destructive/5"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header bar */}
        <header className="h-14 bg-card border-b flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground transition-colors">
              <Leaf className="h-4 w-4 text-emerald-600" />
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              View site
            </a>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors md:hidden"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="max-w-6xl mx-auto p-4 md:p-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 flex pb-2 shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[60px] text-[9px] gap-0.5 px-0.5 transition-colors ${
                active
                  ? 'text-emerald-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-emerald-600' : ''}`} />
              <span className={`w-full text-center truncate ${active ? 'font-medium' : ''}`}>
                {item.short}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getAdminOverview } from '@/lib/admin-overview'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  HeartHandshake,
  Image,
  Inbox,
  MessageSquare,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react'

/**
 * Admin → Dashboard (server-rendered).
 *
 * This was a client component that fetched three endpoints after hydration and
 * showed skeletons in the meantime. It is now a server component reading
 * `getAdminOverview()` directly, so the numbers are in the first render — no
 * client round-trip, no skeleton, and `/api/content` no longer ships the whole
 * CMS blob just to count products.
 *
 * Auth is checked HERE as well as in middleware: the page queries the database
 * itself, and middleware's cookie check is not an authorisation check. A
 * forged cookie must reach a redirect, not a rendered admin dashboard.
 *
 * The "Needs your attention" row and the header bell read the same
 * `getAdminNotifications()` aggregation, so the two can never disagree.
 */
export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login')
  }

  const { stats, recentInquiries, notifications } = await getAdminOverview()
  const counts = notifications.counts

  const attention = [
    {
      key: 'donations' as const,
      label: 'Donation requests',
      hint: 'Pledges to confirm',
      href: '/admin/donations?tab=direct',
      icon: HeartHandshake,
      countClass: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-100 dark:bg-rose-950/60',
    },
    {
      key: 'orders' as const,
      label: 'Orders awaiting payment',
      hint: 'Confirm money received',
      href: '/admin/orders',
      icon: ClipboardList,
      countClass: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-950/60',
    },
    {
      key: 'cancellations' as const,
      label: 'Cancellation requests',
      hint: 'Paid orders to review',
      href: '/admin/orders',
      icon: AlertTriangle,
      countClass: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-950/60',
    },
    {
      key: 'failedMessages' as const,
      label: 'Failed texts',
      hint: 'Retry from Messages',
      href: '/admin/donations?tab=messages',
      icon: MessageSquare,
      countClass: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-950/60',
    },
    {
      key: 'inquiries' as const,
      label: 'Unread inquiries',
      hint: 'Open the inbox',
      href: '/admin/inquiries',
      icon: Inbox,
      countClass: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-100 dark:bg-sky-950/60',
    },
  ]

  const quickActions = [
    {
      title: 'Edit Products',
      description: `Manage ${stats.productsCount} products, pricing and featured items`,
      icon: ShoppingBag,
      href: '/admin/content',
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-950',
    },
    {
      title: 'Media Library',
      description: 'Upload and manage product images and videos',
      icon: Image,
      href: '/admin/media',
      color: 'text-purple-600',
      bg: 'bg-purple-100 dark:bg-purple-950',
    },
    {
      title: 'Inquiries',
      description: `View customer inquiries${counts.inquiries ? ` (${counts.inquiries} unread)` : ''}`,
      icon: MessageSquare,
      href: '/admin/inquiries',
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-950',
    },
    {
      title: 'View Live Site',
      description: 'See your products and content in action',
      icon: Eye,
      href: '/',
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-950',
    },
  ]

  const statCards = [
    {
      label: 'Products for Sale',
      value: stats.productsCount,
      sub: `${stats.featuredCount} featured`,
      icon: ShoppingBag,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-900/50',
      href: '/admin/content',
    },
    {
      label: 'Unread Inquiries',
      value: stats.unreadInquiries,
      sub: `${stats.totalInquiries} total`,
      icon: Inbox,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/50',
      href: '/admin/inquiries',
    },
    {
      label: 'Media Files',
      value: stats.mediaCount,
      sub: 'for products & site',
      icon: Image,
      color: 'text-purple-600',
      bg: 'bg-purple-100 dark:bg-purple-900/50',
      href: '/admin/media',
    },
    {
      label: 'Projects',
      value: stats.projectsCount,
      sub: `${stats.photosCount} photos, ${stats.videosCount} videos`,
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-900/50',
      href: '/admin/content',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your products, inquiries and site content.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/inquiries">
            <Button variant="outline" className="gap-2">
              <Inbox className="h-4 w-4" />
              Inbox {stats.unreadInquiries ? `(${stats.unreadInquiries})` : ''}
            </Button>
          </Link>
          <Link href="/admin/content">
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <FileText className="h-4 w-4" />
              Manage Products
            </Button>
          </Link>
        </div>
      </div>

      {/* Needs your attention — the actionable half */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Needs your attention
          {counts.total === 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              All clear
            </span>
          )}
        </h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {attention.map((tile) => {
            const Icon = tile.icon
            const value = counts[tile.key]
            return (
              <Link key={tile.key} href={tile.href}>
                <Card
                  className={`h-full transition-all hover:shadow-md ${
                    value > 0
                      ? 'border-emerald-500/30 hover:border-emerald-500/60'
                      : 'hover:border-border'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className={`h-9 w-9 rounded-lg ${tile.bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${tile.countClass}`} />
                      </div>
                      <span
                        className={`text-2xl font-bold tabular-nums ${
                          value > 0 ? tile.countClass : 'text-muted-foreground'
                        }`}
                      >
                        {value}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-tight">{tile.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{tile.hint}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-all hover:border-emerald-500/30 cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                    <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                    {stat.sub && (
                      <p className="text-xs text-muted-foreground/70">{stat.sub}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.href} href={action.href}>
                <Card className="hover:shadow-md transition-all hover:border-emerald-500/30 cursor-pointer h-full group">
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between">
                      <div className={`h-10 w-10 rounded-lg ${action.bg} flex items-center justify-center mb-2`}>
                        <Icon className={`h-5 w-5 ${action.color}`} />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardTitle className="text-base mt-1">{action.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent inquiries & overview */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Recent Inquiries
              </CardTitle>
              <Link href="/admin/inquiries">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  View all <ArrowUpRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentInquiries.length > 0 ? (
              <div className="space-y-1">
                {recentInquiries.map((inq) => (
                  <Link
                    key={inq.id}
                    href="/admin/inquiries"
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{inq.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{inq.email}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(inq.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2" />
                <p className="text-sm">No inquiries yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Content Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Products', count: stats.productsCount, icon: ShoppingBag, desc: `${stats.featuredCount} featured` },
                { name: 'Projects', count: stats.projectsCount, icon: TrendingUp, desc: 'sub-brands' },
                { name: 'Inquiries', count: stats.totalInquiries, icon: MessageSquare, desc: `${stats.unreadInquiries} unread` },
                { name: 'Media', count: stats.mediaCount, icon: Image, desc: 'files uploaded' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} {item.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4">
              <Link href="/admin/content">
                <Button variant="outline" className="w-full gap-2">
                  <FileText className="h-4 w-4" />
                  Edit All Content
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

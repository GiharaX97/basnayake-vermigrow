'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  FileText,
  Settings,
  Eye,
  Image,
  MessageSquare,
  ShoppingBag,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Inbox,
  Users,
  Sprout,
  BarChart3,
  DollarSign,
  Package,
} from 'lucide-react'

interface DashboardStats {
  unreadInquiries: number
  totalInquiries: number
  productsCount: number
  featuredCount: number
  mediaCount: number
  projectsCount: number
  photosCount: number
  videosCount: number
  recentInquiries: Array<{ id: string; name: string; email: string; createdAt: string }>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [contentRes, inquiriesRes, mediaRes] = await Promise.all([
          fetch('/api/content'),
          fetch('/api/inquiries'),
          fetch('/api/media'),
        ])
        const content = await contentRes.json()
        const inquiries = await inquiriesRes.json()
        const media = await mediaRes.json()

        setStats({
          unreadInquiries: inquiries.filter((i: any) => i.status === 'unread').length,
          totalInquiries: inquiries.length,
          productsCount: content?.products?.length ?? 0,
          featuredCount: content?.products?.filter((p: any) => p.featured).length ?? 0,
          mediaCount: media?.length ?? 0,
          projectsCount: content?.projects?.length ?? 0,
          photosCount: content?.photos?.length ?? 0,
          videosCount: content?.videos?.length ?? 0,
          recentInquiries: inquiries.slice(0, 5),
        })
      } catch {
        setStats({
          unreadInquiries: 0,
          totalInquiries: 0,
          productsCount: 0,
          featuredCount: 0,
          mediaCount: 0,
          projectsCount: 0,
          photosCount: 0,
          videosCount: 0,
          recentInquiries: [],
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const quickActions = [
    {
      title: 'Edit Products',
      description: `Manage ${stats?.productsCount || 0} products, pricing and featured items`,
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
      description: `View customer inquiries${stats?.unreadInquiries ? ` (${stats.unreadInquiries} unread)` : ''}`,
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
      value: stats?.productsCount ?? 0,
      sub: `${stats?.featuredCount ?? 0} featured`,
      icon: ShoppingBag,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-900/50',
      href: '/admin/content',
    },
    {
      label: 'Unread Inquiries',
      value: stats?.unreadInquiries ?? 0,
      sub: `${stats?.totalInquiries ?? 0} total`,
      icon: Inbox,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/50',
      href: '/admin/inquiries',
    },
    {
      label: 'Media Files',
      value: stats?.mediaCount ?? 0,
      sub: `for products & site`,
      icon: Image,
      color: 'text-purple-600',
      bg: 'bg-purple-100 dark:bg-purple-900/50',
      href: '/admin/media',
    },
    {
      label: 'Projects',
      value: stats?.projectsCount ?? 0,
      sub: `${stats?.photosCount ?? 0} photos, ${stats?.videosCount ?? 0} videos`,
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
              Inbox {stats?.unreadInquiries ? `(${stats.unreadInquiries})` : ''}
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
                    <div className="text-3xl font-bold tracking-tight">
                      {loading ? (
                        <span className="inline-block h-8 w-12 rounded bg-muted animate-pulse" />
                      ) : (
                        stat.value
                      )}
                    </div>
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
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                      <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentInquiries && stats.recentInquiries.length > 0 ? (
              <div className="space-y-1">
                {stats.recentInquiries.map((inq) => (
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
                { name: 'Products', count: stats?.productsCount ?? 0, icon: ShoppingBag, desc: `${stats?.featuredCount ?? 0} featured` },
                { name: 'Projects', count: stats?.projectsCount ?? 0, icon: TrendingUp, desc: 'sub-brands' },
                { name: 'Inquiries', count: stats?.totalInquiries ?? 0, icon: MessageSquare, desc: `${stats?.unreadInquiries ?? 0} unread` },
                { name: 'Media', count: stats?.mediaCount ?? 0, icon: Image, desc: 'files uploaded' },
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
                        {loading ? '...' : `${item.count} ${item.desc}`}
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

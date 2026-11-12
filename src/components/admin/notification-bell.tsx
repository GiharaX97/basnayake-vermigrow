'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  Check,
  ClipboardList,
  HeartHandshake,
  Inbox,
  Loader2,
  MessageSquare,
} from 'lucide-react'

/**
 * The admin header's notification bell.
 *
 * Polls `/api/admin/notifications` every minute (and immediately on tab focus),
 * shows the number of things waiting on a person, and lists the newest of them
 * with a direct link to the page that fixes each one. A new pledge, an order
 * awaiting payment, a cancellation request, a failed text or an unread inquiry
 * should be visible without touring four pages.
 *
 * What counts as "new" is local to this browser: the last time the admin
 * acknowledged the feed is stored in localStorage, and items newer than that
 * get a dot. The badge itself always shows the ACTIONABLE total, not the unseen
 * count — a pledge acknowledged a week ago and still unconfirmed is still work.
 */

interface NotificationItem {
  id: string
  kind: 'donation' | 'order' | 'cancel' | 'message' | 'inquiry'
  title: string
  detail: string
  href: string
  createdAt: string
}

interface NotificationSummary {
  counts: {
    donations: number
    orders: number
    cancellations: number
    failedMessages: number
    inquiries: number
    total: number
  }
  items: NotificationItem[]
  generatedAt: string
}

const SEEN_KEY = 'basnayake-admin-notifications-seen'
const POLL_MS = 60_000

const KIND_META: Record<
  NotificationItem['kind'],
  { icon: typeof Bell; className: string; bg: string }
> = {
  donation: {
    icon: HeartHandshake,
    className: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-100 dark:bg-rose-950/60',
  },
  order: {
    icon: ClipboardList,
    className: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-950/60',
  },
  cancel: {
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
  },
  message: {
    icon: MessageSquare,
    className: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/60',
  },
  inquiry: {
    icon: Inbox,
    className: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-100 dark:bg-sky-950/60',
  },
}

function readSeenAt(): number {
  try {
    const value = window.localStorage.getItem(SEEN_KEY)
    const parsed = value ? Date.parse(value) : Number.NaN
    return Number.isFinite(parsed) ? parsed : Number.NaN
  } catch {
    // Private mode / blocked storage: degrade to "nothing is new", never crash.
    return Number.NaN
  }
}

function writeSeenAt(): number {
  const now = Date.now()
  try {
    window.localStorage.setItem(SEEN_KEY, new Date(now).toISOString())
  } catch {
    // Storage unavailable — the badge still works for this page load.
  }
  return now
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationBell() {
  const [summary, setSummary] = useState<NotificationSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  /** Baseline for the "new" dot; NaN until the client has read localStorage. */
  const [seenAt, setSeenAt] = useState<number>(Number.NaN)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const stored = readSeenAt()
    // No stored baseline (first visit on this browser) → everything already
    // here is "old". Only things that arrive NEXT are worth a dot.
    setSeenAt(Number.isFinite(stored) ? stored : Date.now())
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' })
      if (!res.ok) {
        setFailed(true)
        return
      }
      setSummary((await res.json()) as NotificationSummary)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => {
      // A hidden tab does not need to poll; it refreshes on focus instead.
      if (document.visibilityState === 'visible') load()
    }, POLL_MS)

    const onFocus = () => load()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  // Close on outside click / Escape, the behaviour every dropdown has.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const counts = summary?.counts
  const total = counts?.total ?? 0
  const items = summary?.items ?? []
  const newCount = Number.isFinite(seenAt)
    ? items.filter((item) => Date.parse(item.createdAt) > seenAt).length
    : 0

  const markAllSeen = () => {
    setSeenAt(writeSeenAt())
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={
          total > 0
            ? `Notifications, ${total} waiting${newCount ? `, ${newCount} new` : ''}`
            : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
        {newCount > 0 && (
          <span
            aria-hidden
            className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          /* On phones this is anchored to the VIEWPORT, not the bell: the bell
             sits left of Logout in the header, so a right-aligned 22rem panel
             hung off its own right edge ran 48px off-screen at 390px wide.
             From `sm` up it is a normal dropdown under the bell. */
          className="fixed inset-x-4 top-14 z-50 overflow-hidden rounded-xl border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(22rem,calc(100vw-2rem))]"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-[11px] text-muted-foreground">
                {total === 0
                  ? 'Nothing waiting on you'
                  : `${total} item${total === 1 ? '' : 's'} waiting on you`}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllSeen}
              disabled={newCount === 0}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-default disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <Check className="h-3 w-3" />
              Mark read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
                <Check className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                <p className="text-xs">
                  New pledges, orders, cancellations, failed texts and inquiries will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((item) => {
                  const meta = KIND_META[item.kind] ?? KIND_META.inquiry
                  const Icon = meta.icon
                  const isNew = Number.isFinite(seenAt) && Date.parse(item.createdAt) > seenAt
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent"
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.bg}`}
                        >
                          <Icon className={`h-4 w-4 ${meta.className}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span className="line-clamp-1 text-sm font-medium">{item.title}</span>
                            {isNew && (
                              <span
                                aria-label="New"
                                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                              />
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {item.detail}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground/70">
                            {timeAgo(item.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t px-4 py-2.5">
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Open dashboard
            </Link>
            {failed && (
              <span className="ml-3 text-[10px] text-destructive">Could not refresh</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

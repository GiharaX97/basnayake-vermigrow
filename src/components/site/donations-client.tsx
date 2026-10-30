'use client'

import * as React from 'react'
import { HeartHandshake, QrCode, ScanLine, Sprout, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Navbar } from '@/components/site/navbar'
import { NoticeTicker } from '@/components/site/notice-ticker'
import { Footer } from '@/components/site/footer'
import { cn } from '@/lib/utils'
import { formatLkr } from '@/lib/currency'

interface DonorEntry {
  id: string
  name: string
  amount: number
  createdAt: string
}

interface DonationsData {
  total: number
  donorCount: number
  donors: DonorEntry[]
}

const POLL_INTERVAL_MS = 10_000

// Ease-out tween so the live total counts up when new sales land.
function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = React.useState(target)
  const currentRef = React.useRef(target)

  React.useEffect(() => {
    const from = currentRef.current
    if (from === target) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (target - from) * eased
      currentRef.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

function DonorWall({ donors }: { donors: DonorEntry[] }) {
  // A short list fits without scrolling; only loop when it overflows the frame.
  const scrolling = donors.length >= 8
  const list = (keyPrefix: string) => (
    <ul className="space-y-1" aria-hidden={keyPrefix !== 'a'}>
      {donors.map((d) => (
        <li
          key={`${keyPrefix}-${d.id}`}
          className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-4 py-2.5"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Sprout className="size-3.5" />
            </span>
            <span className="truncate text-sm font-medium">{d.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 pl-3">
            {d.amount > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                {formatLkr(d.amount)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )

  if (donors.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center px-6">
        <ScanLine className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          The wall is waiting for its first name.
          <br />
          Buy a pack, scan the code, and be the first.
        </p>
      </div>
    )
  }

  if (!scrolling) {
    return <div>{list('a')}</div>
  }

  return (
    <div className="relative h-[420px] overflow-hidden">
      {/* Fade edges so names dissolve in and out */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-card to-transparent" />
      <div className="marquee-track space-y-1">
        {list('a')}
        {list('b')}
      </div>
    </div>
  )
}

export function DonationsClient() {
  const [data, setData] = React.useState<DonationsData | null>(null)
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/donations', { cache: 'no-store' })
      if (!res.ok) return
      setData(await res.json())
    } catch {
      // Keep the last known values on transient failures
    }
  }, [])

  React.useEffect(() => {
    load()
    const interval = setInterval(() => {
      if (!document.hidden) load()
    }, POLL_INTERVAL_MS)
    const onVisible = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // Pack QR scan: /donations?c=VG-XXXXXX — printed codes land here.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('c')
    if (!code) return
    // Strip the code so refreshes/shares don't rescan it
    window.history.replaceState(null, '', window.location.pathname)
    ;(async () => {
      try {
        const res = await fetch('/api/donations/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        if (res.status === 404) {
          toast.error('That code isn’t one of ours — please check the QR on your pack.')
          return
        }
        const body = await res.json()
        if (!res.ok) {
          toast.error(body?.error ?? 'Could not verify this pack. Please try again.')
          return
        }
        if (body.status === 'sold') {
          toast.success(
            `Pack verified — ${formatLkr(body.donation ?? 0)} added to the Apeksha Hospital fund. Thank you!`
          )
        } else if (body.status === 'redeemed') {
          // A workshop seat: scanning confirms attendance, it does not add money.
          // The contribution was booked when the seat was paid for, so this must
          // never say "added to the fund".
          toast.success(`Seat confirmed for ${body.product ?? 'your workshop'} — see you there!`)
        } else if (body.status === 'already_redeemed') {
          toast.info('This seat is already checked in — no need to scan again.')
        } else {
          toast.info('This pack was already scanned before — no double counting.')
        }
        load()
      } catch {
        toast.error('Network error while verifying your pack.')
      }
    })()
  }, [load])

  const animatedTotal = useAnimatedNumber(data?.total ?? 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      toast.error('Please enter your name (at least 2 characters).')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, phone: phone.trim() }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not add your name. Please try again.')
        return
      }
      setData((prev) =>
        prev
          ? { ...prev, donorCount: prev.donorCount + 1, donors: [body as DonorEntry, ...prev.donors] }
          : prev
      )
      setName('')
      setPhone('')
      toast.success(
        phone.trim()
          ? `Thank you, ${trimmed}! Your name is on the wall — we will send you a thank-you.`
          : `Thank you, ${trimmed}! Your name is on the wall.`
      )
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NoticeTicker />
      <Navbar />
      <main className="flex-1">
        {/* Hero with the live total */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
              </span>
              Live donation total
            </span>
            {data ? (
              <p className="mt-6 text-5xl sm:text-7xl font-bold tracking-tight tabular-nums">
                {formatLkr(animatedTotal)}
              </p>
            ) : (
              <Skeleton className="mt-6 h-16 w-72 mx-auto bg-white/10" />
            )}
            <p className="mt-4 text-base sm:text-lg text-emerald-100 max-w-xl mx-auto">
              Every pack of Basnayaka Vermigrow sold at our store and partner
              retailers contributes to Apeksha Hospital. Grown in the soil,
              given back to the community.
            </p>
            {data && data.donorCount > 0 && (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-100/90">
                <Users className="size-4" />
                {data.donorCount} {data.donorCount === 1 ? 'person has' : 'people have'} added their name to the wall
              </p>
            )}
          </div>
        </section>

        {/* Entry + wall */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 grid gap-10 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <HeartHandshake className="size-6 text-emerald-600" />
                Scanned your pack?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Welcome! Add your name below and see it join the wall of
                everyone who is giving back, one pack at a time.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="donor-name" className="text-sm font-medium">
                Your name
              </label>
              <Input
                id="donor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nimal Perera"
                maxLength={60}
                className="h-12 text-base"
                autoComplete="name"
              />
              {/* Optional, and it is never shown on the wall — GET /api/donations
                  does not select a phone from the Donor table, because it has no
                  phone column at all. This is only so we can text a thank-you. */}
              <label htmlFor="donor-phone" className="text-sm font-medium block pt-1">
                Mobile <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="donor-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07X XXX XXXX"
                maxLength={20}
                className="h-12 text-base"
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                Only so we can send you a thank-you. We never show it on this page.
              </p>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-500"
              >
                {submitting ? 'Adding…' : 'Add my name to the wall'}
              </Button>
            </form>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                How it works
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">1</span>
                  <span>Buy any Basnayaka Vermigrow pack in store or from a partner retailer.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">2</span>
                  <span>Scan the QR code on the pack — it brings you here.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">3</span>
                  <span>LKR 20 from your pack goes to Apeksha Hospital, and your name joins the wall.</span>
                </li>
              </ol>
              <p className="flex items-start gap-2 text-xs text-muted-foreground pt-1 border-t">
                <QrCode className="size-4 shrink-0 mt-0.5" />
                The total updates live as packs are sold across the island.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Donation wall</h2>
              <span className="text-xs text-muted-foreground">latest first</span>
            </div>
            <div className={cn('rounded-xl border bg-card p-4', !data && 'min-h-64')}>
              {data ? (
                <DonorWall donors={data.donors} />
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

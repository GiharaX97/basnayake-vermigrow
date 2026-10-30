'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/site/navbar'
import { NoticeTicker } from '@/components/site/notice-ticker'
import { Footer } from '@/components/site/footer'
import { formatLkr } from '@/lib/currency'

/**
 * Where Payments.lk sends the customer after the hosted checkout.
 *
 * THE BROWSER RETURN PROVES NOTHING. This page writes nothing and settles
 * nothing; it polls our own database, which is updated only by the signed
 * webhook. If the webhook is a second behind the redirect, the honest thing to
 * show is "still confirming", not a fake success.
 */

type State = 'loading' | 'paid' | 'pending' | 'cancelled' | 'notfound'

interface StatusBody {
  status?: string
  total?: number
  error?: string
}

export function OrderCompleteClient({ orderRef }: { orderRef: string }) {
  const validRef = /^VG-O-[A-Z0-9]{6}$/.test(orderRef)
  // Derived from the URL on first render — an incomplete link is not "checking",
  // it is "not found", and setting that from an effect would be a cascading render.
  const [state, setState] = React.useState<State>(validRef ? 'loading' : 'notfound')
  const [total, setTotal] = React.useState<number | null>(null)
  // A handful of polls: the webhook usually lands before the customer does. After
  // that, stop asking and tell them the message will come.
  const [polls, setPolls] = React.useState(0)

  React.useEffect(() => {
    if (!validRef) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = async () => {
      try {
        const res = await fetch(`/api/orders/status?ref=${encodeURIComponent(orderRef)}`, {
          cache: 'no-store',
        })
        if (res.status === 404) {
          if (!cancelled) setState('notfound')
          return
        }
        const body = (await res.json().catch(() => ({}))) as StatusBody
        if (cancelled) return
        if (typeof body.total === 'number') setTotal(body.total)
        if (body.status === 'paid') return setState('paid')
        if (body.status === 'cancelled') return setState('cancelled')
        // pending, or mixed (a partial order) — still waiting on the webhook.
        setState('pending')
        if (polls < 10) timer = setTimeout(() => setPolls((n) => n + 1), 3000)
      } catch {
        if (!cancelled) setState('pending')
        if (polls < 10) timer = setTimeout(() => setPolls((n) => n + 1), 3000)
      }
    }

    void check()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [orderRef, validRef, polls])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NoticeTicker />
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          {state === 'loading' && (
            <>
              <Clock3 className="mx-auto size-14 text-muted-foreground/60 animate-pulse" />
              <h1 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight">
                Checking your payment…
              </h1>
              <p className="mt-3 text-muted-foreground">This should only take a moment.</p>
            </>
          )}

          {state === 'paid' && (
            <>
              <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
              <h1 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight">
                Payment received — thank you
              </h1>
              <p className="mt-3 text-muted-foreground">
                Your order <span className="font-mono font-semibold text-foreground">{orderRef}</span> is
                paid{total !== null ? ` (${formatLkr(total)})` : ''}. We have texted your receipt and
                will call you to confirm delivery or workshop details.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/order">Place another order</Link>
                </Button>
                <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-500">
                  <Link href="/donations">See the donation wall</Link>
                </Button>
              </div>
            </>
          )}

          {state === 'pending' && (
            <>
              <Clock3 className="mx-auto size-14 text-amber-500" />
              <h1 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight">
                We are still confirming your payment
              </h1>
              <p className="mt-3 text-muted-foreground">
                Order <span className="font-mono font-semibold text-foreground">{orderRef}</span>{' '}
                {total !== null ? `(${formatLkr(total)}) ` : ''}is not marked paid yet. If the card page
                said the payment went through, give it a minute — the confirmation arrives separately.
                You will get a text as soon as it is confirmed. Nothing has been charged twice, and
                you can safely close this page.
              </p>
              <p className="mt-6 text-xs text-muted-foreground">
                Still showing unpaid after a while? Call the farm with your reference and we will check it.
              </p>
            </>
          )}

          {state === 'cancelled' && (
            <>
              <XCircle className="mx-auto size-14 text-rose-500" />
              <h1 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight">
                This order was cancelled
              </h1>
              <p className="mt-3 text-muted-foreground">
                Order <span className="font-mono font-semibold text-foreground">{orderRef}</span> is
                cancelled, so no card payment can be taken for it. If that is a surprise, please call us.
              </p>
              <Button asChild className="mt-8 rounded-full">
                <Link href="/order">Start a new order</Link>
              </Button>
            </>
          )}

          {state === 'notfound' && (
            <>
              <XCircle className="mx-auto size-14 text-muted-foreground/60" />
              <h1 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight">
                We could not find that order
              </h1>
              <p className="mt-3 text-muted-foreground">
                Check the reference in your text message, or call the farm and we will look it up.
              </p>
              <Button asChild className="mt-8 rounded-full">
                <Link href="/order">Back to ordering</Link>
              </Button>
            </>
          )}

          <p className="mt-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Card details are handled entirely by Payments.lk — never by this site.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}

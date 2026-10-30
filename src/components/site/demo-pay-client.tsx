'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/site/navbar'
import { NoticeTicker } from '@/components/site/notice-ticker'
import { Footer } from '@/components/site/footer'
import { formatLkr } from '@/lib/currency'

/**
 * DEMO checkout — stands in for Payments.lk's hosted page when no provider keys
 * are configured. The button posts to /api/payments/demo, which SIGNS a realistic
 * webhook event and delivers it to our real webhook endpoint. Everything after
 * that click is the production path: signature check → amount/mode checks →
 * settleOrderTx → ledger → SMS.
 */
export function DemoPayClient({ orderRef }: { orderRef: string }) {
  const router = useRouter()
  const [total, setTotal] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<'pay' | 'fail' | null>(null)
  // Derived, not stored: an incomplete link is invalid from the first render.
  const invalidRef = !/^VG-O-[A-Z0-9]{6}$/.test(orderRef)

  React.useEffect(() => {
    if (invalidRef) return
    fetch(`/api/orders/status?ref=${encodeURIComponent(orderRef)}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error ?? 'Order not found')
        setTotal(typeof body.total === 'number' ? body.total : null)
      })
      .catch((e: Error) => setError(e.message))
  }, [orderRef, invalidRef])

  const run = async (outcome: 'succeeded' | 'failed') => {
    setBusy(outcome === 'succeeded' ? 'pay' : 'fail')
    try {
      const res = await fetch('/api/payments/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderRef, outcome }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.ok !== true) {
        toast.error(body?.error ?? 'The demo payment did not go through.')
        return
      }
      toast.success(outcome === 'succeeded' ? 'Demo payment sent.' : 'Demo decline sent.')
      router.push(`/order/complete?ref=${encodeURIComponent(orderRef)}`)
    } catch {
      toast.error('Network error while sending the demo payment.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NoticeTicker />
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-lg px-4 sm:px-6 py-16">
          <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600">
              <CreditCard className="size-4" />
              Demo checkout — no real money
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pay for your order</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This stands in for the Payments.lk card page because no gateway keys are configured on
              this machine.
            </p>

            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Order</dt>
                <dd className="font-mono font-semibold">{orderRef}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-semibold tabular-nums">
                  {total !== null ? formatLkr(total) : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Test card</dt>
                <dd className="font-mono">VISA ···· 4242</dd>
              </div>
            </dl>

            {invalidRef || error ? (
              <p className="mt-6 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {invalidRef ? 'This demo checkout link is incomplete.' : error}
              </p>
            ) : (
              <div className="mt-8 space-y-3">
                <Button
                  onClick={() => run('succeeded')}
                  disabled={busy !== null || total === null}
                  className="w-full rounded-full bg-emerald-600 hover:bg-emerald-500"
                >
                  <CreditCard className="size-4" />
                  {busy === 'pay' ? 'Sending signed event…' : `Pay ${total !== null ? formatLkr(total) : ''} (demo)`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => run('failed')}
                  disabled={busy !== null || total === null}
                  className="w-full rounded-full"
                >
                  <XCircle className="size-4" />
                  {busy === 'fail' ? 'Sending signed event…' : 'Simulate a declined card'}
                </Button>
              </div>
            )}

            <p className="mt-6 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              The click above signs a webhook event and posts it to the real endpoint. The order is
              settled only if the signature, mode and amount all match.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

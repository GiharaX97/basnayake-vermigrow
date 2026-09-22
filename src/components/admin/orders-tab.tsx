'use client'

import { useEffect, useState } from 'react'
import { formatLkr } from '@/lib/currency'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  STALE_PENDING_HOURS,
  type PaymentMethod,
} from '@/lib/payments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, Loader2, Phone, RefreshCw, ShoppingCart } from 'lucide-react'

interface OrderLine {
  id: string
  name: string
  kind: string
  unit: string
  quantity: number
  unitPrice: number
  lineTotal: number
  donationAmount: number
  status: string
}

interface OrderPayment {
  id: string
  amount: number
  method: string
  reference: string | null
  receivedBy: string | null
  receivedAt: string
}

type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'mixed'

interface Order {
  orderRef: string
  status: OrderStatus
  lines: OrderLine[]
  customer: { name: string | null; phone: string | null; email: string | null }
  note: string | null
  total: number
  donationTotal: number
  createdAt: string
  ageHours: number
  isStale: boolean
  paidAt: string | null
  paymentMethod: string
  payment: OrderPayment | null
}

interface OrdersResponse {
  orders: Order[]
  pendingCount: number
  stalePendingCount: number
  pendingTotal: number
  pendingDonation: number
}

/** "3 days" / "5 h" — how long a pending order has been waiting. */
function formatAge(hours: number): string {
  if (hours < 1) return 'just now'
  if (hours < 24) return `${Math.floor(hours)} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day' : `${days} days`
}

function StatusBadge({ order }: { order: Order }) {
  if (order.status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Paid
      </span>
    )
  }
  if (order.status === 'cancelled') {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Cancelled
      </span>
    )
  }
  if (order.status === 'mixed') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Part-settled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      Awaiting payment
    </span>
  )
}

/**
 * Customer-placed online orders, newest first.
 *
 * An order is a group of `Sale` rows sharing an `orderRef` (the DB stays
 * row-shaped, the UI is order-shaped). Nothing here counts toward the public
 * donation total until "Mark paid" writes the ledger entry — a pending order is
 * a request, not money.
 */
export function OrdersTab({ onSettled }: { onSettled?: () => void }) {
  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<'pending' | 'paid' | 'cancelled' | 'all'>('pending')

  const [payTarget, setPayTarget] = useState<Order | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [settling, setSettling] = useState(false)

  // Mark-paid form
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [note, setNote] = useState('')

  const refresh = () => setReloadKey((k) => k + 1)

  // Inline async effect rather than a `load()` helper: calling a
  // component-scope function that sets state trips react-hooks/set-state-in-effect,
  // whereas setting state after an `await` is provably not a cascading render.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/orders')
        if (!res.ok) throw new Error('failed')
        const body: OrdersResponse = await res.json()
        if (!cancelled) setData(body)
      } catch {
        if (!cancelled) toast.error('Could not load orders')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const openPay = (order: Order) => {
    setPayTarget(order)
    setMethod('cash')
    setReference('')
    setReceivedBy('')
    setNote('')
  }

  const settle = async (order: Order, action: 'pay' | 'cancel') => {
    setSettling(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.orderRef)}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'pay' ? { action, method, reference, receivedBy, note } : { action }
        ),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not settle this order')
        return
      }
      if (action === 'pay') {
        toast.success(
          `${formatLkr(body.donationTotal)} added to the fund — ${order.orderRef} marked paid`
        )
      } else {
        toast.success(
          body.donationRemoved > 0
            ? `Order cancelled — public total reduced by ${formatLkr(body.donationRemoved)}`
            : 'Order cancelled — its seats are free again'
        )
      }
      setPayTarget(null)
      setCancelTarget(null)
      refresh()
      onSettled?.()
    } catch {
      toast.error('Network error')
    } finally {
      setSettling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const orders = data?.orders ?? []
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const pendingCount = data?.pendingCount ?? 0

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="size-4 text-emerald-600" /> Awaiting payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.stalePendingCount ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3" />
                  {data.stalePendingCount} waiting over {STALE_PENDING_HOURS}h
                </span>
              ) : (
                'Nothing overdue'
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Value to collect
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatLkr(data?.pendingTotal ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across unpaid orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Donation on settle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatLkr(data?.pendingDonation ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Not counted yet — added when paid
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['pending', 'paid', 'cancelled', 'all'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            className={filter === f ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'pending' ? 'Awaiting payment' : f === 'paid' ? 'Paid' : 'Cancelled'}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto gap-2" onClick={refresh}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {orders.length === 0
              ? 'No online orders yet. Orders placed at /order appear here for you to confirm payment.'
              : `No ${filter === 'all' ? '' : filter} orders.`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((order) => (
            <Card
              key={order.orderRef}
              className={order.status === 'cancelled' ? 'opacity-60' : undefined}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base font-mono">{order.orderRef}</CardTitle>
                  <StatusBadge order={order} />
                  {order.isStale && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      <AlertTriangle className="size-3" /> Waiting {formatAge(order.ageHours)}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(order.createdAt), 'd MMM yyyy, HH:mm')}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{order.customer.name ?? 'Name not given'}</span>
                  {order.customer.phone && (
                    <a
                      href={`tel:${order.customer.phone}`}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="size-3.5" /> {order.customer.phone}
                    </a>
                  )}
                  {order.customer.email && (
                    <span className="text-muted-foreground">{order.customer.email}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border divide-y">
                  {order.lines.map((line) => (
                    <div key={line.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="font-medium">
                        {line.name}
                        {line.kind === 'service' && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            {line.quantity === 1 ? 'seat' : 'seats'}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">×{line.quantity}</span>
                      <span className="ml-auto tabular-nums">{formatLkr(line.lineTotal)}</span>
                      <span className="w-24 text-right text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                        +{formatLkr(line.donationAmount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span>
                    Total <strong className="tabular-nums">{formatLkr(order.total)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Donation{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatLkr(order.donationTotal)}
                    </strong>
                  </span>
                </div>

                {order.note && (
                  <p className="text-xs text-muted-foreground">
                    Customer note: {order.note}
                  </p>
                )}

                {order.status === 'paid' && order.payment && (
                  <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 text-xs text-muted-foreground">
                    Received {formatLkr(order.payment.amount)} by{' '}
                    {PAYMENT_METHOD_LABELS[order.payment.method as PaymentMethod] ??
                      order.payment.method}
                    {order.payment.reference ? ` · ref ${order.payment.reference}` : ''}
                    {order.payment.receivedBy ? ` · taken by ${order.payment.receivedBy}` : ''}
                    {order.paidAt ? ` · ${format(new Date(order.paidAt), 'd MMM yyyy, HH:mm')}` : ''}
                  </div>
                )}

                {(order.status === 'pending' || order.status === 'mixed') && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => openPay(order)}
                    >
                      <CheckCircle2 className="size-4" /> Mark paid
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelTarget(order)}>
                      Cancel order
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mark paid */}
      <Dialog open={payTarget !== null} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment for {payTarget?.orderRef}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount received</span>
                <strong className="tabular-nums">{formatLkr(payTarget?.total ?? 0)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Added to the fund</span>
                <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatLkr(payTarget?.donationTotal ?? 0)}
                </strong>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">How was it received?</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger id="pay-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bank slip no. or transaction id"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-by">Received by (optional)</Label>
              <Input
                id="pay-by"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Who took the money"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Note (optional)</Label>
              <Input
                id="pay-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => payTarget && settle(payTarget, 'pay')}
              disabled={settling}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {settling && <Loader2 className="size-4 animate-spin" />}
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel — says exactly what it does to the public number */}
      <AlertDialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelTarget?.orderRef}?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && cancelTarget.status === 'paid' ? (
                <>
                  This order was already paid, so the public donation total will drop by{' '}
                  <strong>{formatLkr(cancelTarget.donationTotal)}</strong>. The payment record is
                  kept. The seats/stock it held are released.
                </>
              ) : (
                <>
                  This releases the seats/stock the order was holding. Nothing has been added to
                  the public total yet, so it will not change.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTarget && settle(cancelTarget, 'cancel')}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

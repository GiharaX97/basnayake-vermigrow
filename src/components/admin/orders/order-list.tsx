'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatLkr } from '@/lib/currency'
import { STALE_PENDING_HOURS, type OrderStatus } from '@/lib/payments'
import { FULFILMENT_LABELS, type FulfilmentStatus } from '@/lib/fulfilment'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import {
  CancelRequestedBadge,
  FulfilmentBadge,
  PaymentBadge,
  formatAge,
} from '@/components/admin/orders/order-badges'

/**
 * The Orders screen — every order the shop has taken, newest first.
 *
 * The list is for FINDING an order and judging its state at a glance; every
 * action lives on the order's own page. That split is deliberate: "Mark paid" and
 * a stage move both write money or text the customer, and neither should be one
 * stray tap away in a scrolling list.
 */

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

interface Order {
  orderRef: string
  status: OrderStatus
  fulfillment: FulfilmentStatus
  fulfillmentAt: string | null
  cancelRequestedAt: string | null
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
}

type StageCounts = Record<FulfilmentStatus, number> & {
  cancelled: number
  cancelRequested: number
}

interface OrdersResponse {
  orders: Order[]
  pendingCount: number
  stalePendingCount: number
  pendingTotal: number
  pendingDonation: number
  stageCounts: StageCounts
  truncated: boolean
}

/**
 * The chips. Each is a predicate over the orders already fetched rather than a
 * server query, because two of these questions — "active" and "cancel
 * requested" — span more than one column and cannot be asked in one SQL clause
 * without an OR that would collide with the search box's own OR.
 */
type Filter = 'all' | 'pending' | 'active' | 'delivered' | 'cancelled' | 'cancel_requested'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting payment' },
  { key: 'active', label: 'In progress' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'cancel_requested', label: 'Cancel requested' },
]

function matches(order: Order, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'pending':
      return order.status === 'pending'
    case 'active':
      // Paid, and not finished. 'mixed' is half-settled and still needs work, so
      // it counts as in progress alongside a fully paid order.
      return (
        (order.status === 'paid' || order.status === 'mixed') &&
        order.fulfillment !== 'delivered'
      )
    case 'delivered':
      return order.status !== 'cancelled' && order.fulfillment === 'delivered'
    case 'cancelled':
      return order.status === 'cancelled'
    case 'cancel_requested':
      return order.cancelRequestedAt !== null
  }
}

export function OrderList() {
  const router = useRouter()
  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')

  // The box the admin is typing in, and the value the request is actually made
  // with. Two states so a keystroke does not fire a query per character.
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const refresh = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Async IIFE rather than a `load()` helper: setting state after an `await` is
  // provably not a cascading render, whereas calling a component-scope function
  // that sets state trips react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // The hard max. Orders are filtered client-side, so the page must be as
        // complete as the API will give — a filter that silently ignored the
        // orders past the cap would be worse than no filter at all.
        const params = new URLSearchParams({ limit: '200' })
        if (query) params.set('q', query)
        const res = await fetch(`/api/admin/orders?${params}`)
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
  }, [reloadKey, query])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const orders = data?.orders ?? []
  const shown = orders.filter((o) => matches(o, filter))
  const counts = data?.stageCounts
  const activeCount = counts
    ? counts.new + counts.confirmed + counts.packed + counts.dispatched
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every order placed at <span className="font-mono">/order</span>. Open one to record
          payment, move it along, or message the customer.
        </p>
      </div>

      {/* Summary. Computed over everything fetched, not over the chip that is
          selected — this is the whole pipeline at a glance, and it should not
          change shape just because a filter is on. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="size-4 text-amber-600" /> Awaiting payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.pendingCount ?? 0}</div>
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
            <p className="text-xs text-muted-foreground mt-1">
              Adds {formatLkr(data?.pendingDonation ?? 0)} to the fund when settled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="size-4 text-sky-600" /> In progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {counts
                ? `${counts.new} to confirm · ${counts.packed} packed · ${counts.dispatched} sent`
                : 'Paid, not yet delivered'}
            </p>
          </CardContent>
        </Card>
        <Card className={counts?.cancelRequested ? 'border-amber-300 dark:border-amber-900' : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" /> Cancel requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{counts?.cancelRequested ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {counts?.cancelRequested
                ? 'Customers asking to cancel — a phone call each'
                : 'No customer is asking to cancel'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search + chips */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number, name, phone or email"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              className={filter === f.key ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto gap-2" onClick={refresh}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {data?.truncated && (
        <p className="text-xs text-muted-foreground">
          Showing the newest {orders.length} matching orders. Narrow the search to see older
          ones.
        </p>
      )}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {orders.length === 0
              ? query
                ? `No orders match “${query}”.`
                : 'No online orders yet. Orders placed at /order appear here for you to confirm payment.'
              : 'No orders match this filter.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="hidden lg:table-cell">Placed</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((order) => (
                  <TableRow
                    key={order.orderRef}
                    // The whole row is the target, not just the reference: an
                    // admin scanning for a phone number should not have to aim at
                    // a 10-character link to open the order.
                    onClick={() => router.push(`/admin/orders/${encodeURIComponent(order.orderRef)}`)}
                    className={`cursor-pointer ${
                      order.status === 'cancelled' ? 'opacity-60' : ''
                    }`}
                  >
                    <TableCell>
                      <Link
                        href={`/admin/orders/${encodeURIComponent(order.orderRef)}`}
                        className="font-mono text-sm font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.orderRef}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {order.lines.length} line{order.lines.length === 1 ? '' : 's'}
                        {order.isStale && (
                          <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3" /> {formatAge(order.ageHours)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {order.customer.name ?? 'Name not given'}
                      </div>
                      {order.customer.phone && (
                        // tel: and stopped from bubbling, so tapping the number
                        // dials instead of opening the order behind it.
                        <a
                          href={`tel:${order.customer.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="size-3" /> {order.customer.phone}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="tabular-nums text-sm font-medium">
                        {formatLkr(order.total)}
                      </div>
                      <div className="tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
                        +{formatLkr(order.donationTotal)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PaymentBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FulfilmentBadge
                          status={order.fulfillment}
                          paymentStatus={order.status}
                        />
                        {order.cancelRequestedAt && <CancelRequestedBadge />}
                      </div>
                      {order.status === 'paid' && order.fulfillment !== 'delivered' && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Next: {nextStageLabel(order.fulfillment)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(order.createdAt), 'd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * What moves next. Only ever a hint — the detail page asks the server which moves
 * are actually legal, because that is the same answer the API enforces.
 */
function nextStageLabel(stage: FulfilmentStatus): string {
  if (stage === 'new') return FULFILMENT_LABELS.confirmed
  if (stage === 'confirmed') return FULFILMENT_LABELS.packed
  if (stage === 'packed') return FULFILMENT_LABELS.dispatched
  if (stage === 'dispatched') return FULFILMENT_LABELS.delivered
  return 'Nothing'
}

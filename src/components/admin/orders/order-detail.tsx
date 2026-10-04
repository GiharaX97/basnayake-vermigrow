'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatLkr } from '@/lib/currency'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  STALE_PENDING_HOURS,
  type PaymentMethod,
} from '@/lib/payments'
import {
  FULFILMENT_LABELS,
  FULFILMENT_ORDER,
  type FulfilmentStage,
  type FulfilmentStatus,
} from '@/lib/fulfilment'
import {
  DELIVERY_LABELS,
  DELIVERY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TEMPLATE_LABELS,
} from '@/components/admin/message-meta'
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
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  HandCoins,
  Home,
  Loader2,
  Mail,
  MessageSquare,
  Package,
  Phone,
  QrCode,
  Send,
  StickyNote,
  Truck,
  Undo2,
} from 'lucide-react'
import {
  CancelRequestedBadge,
  FulfilmentBadge,
  PaymentBadge,
  formatAge,
} from '@/components/admin/orders/order-badges'

/**
 * One order, and everything an admin can do to it.
 *
 * This is where every action lives. The list only finds orders; the money and the
 * text messages happen here, where the customer's number, the lines and the
 * history are all in front of the person about to press the button.
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
  fulfillment: string | null
}

interface Payment {
  id: string
  amount: number
  method: string
  reference: string | null
  receivedBy: string | null
  note: string | null
  receivedAt: string
}

interface OrderEvent {
  id: string
  type: string
  fromStage: string | null
  toStage: string | null
  actor: string
  note: string | null
  createdAt: string
}

interface OrderMessage {
  id: string
  template: string
  body: string
  status: string
  toName: string | null
  toPhone: string | null
  sentAt: string | null
  sentBy: string | null
  error: string | null
  providerMessageId: string | null
  deliveryStatus: string | null
  deliveredAt: string | null
  createdAt: string
}

interface Voucher {
  code: string
  status: string
  holderName: string | null
  redeemedAt: string | null
  deliveredAt: string | null
}

interface OrderDetail {
  orderRef: string
  status: 'pending' | 'paid' | 'cancelled' | 'mixed'
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
  payments: Payment[]
  vouchers: Voucher[]
  allowedStages: FulfilmentStage[]
  canPay: boolean
  canCancel: boolean
  link: { revokedAt: string | null; expiresAt: string | null } | null
}

interface DetailResponse {
  order: OrderDetail
  events: OrderEvent[]
  messages: OrderMessage[]
}

const EVENT_ICONS: Record<string, typeof CheckCircle2> = {
  note: StickyNote,
  settled: HandCoins,
  cancelled: Ban,
  confirmed: CheckCircle2,
  packed: Package,
  dispatched: Truck,
  delivered: Home,
  stage_reverted: Undo2,
  cancel_requested: AlertTriangle,
  cancel_request_dismissed: CheckCircle2,
  sms_inbound: MessageSquare,
}

const ACTOR_LABELS: Record<string, string> = {
  admin: 'Admin',
  sms: 'Customer',
  system: 'System',
}

const VOUCHER_STYLES: Record<string, string> = {
  issued: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  redeemed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  dispatched: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  sold: 'bg-muted text-muted-foreground',
}

/** One line of the timeline, in words the admin recognises. */
function eventLabel(event: OrderEvent): string {
  if (event.type === 'note') return 'Note'
  if (event.type === 'settled') return 'Payment recorded'
  if (event.type === 'cancelled') return 'Order cancelled'
  if (event.type === 'stage_reverted') {
    return `Moved back to ${stageName(event.toStage)}`
  }
  if (event.type === 'cancel_requested') return 'Customer asked to cancel'
  if (event.type === 'cancel_request_dismissed') return 'Cancel request dismissed'
  if (event.type === 'sms_inbound') return 'Customer replied by SMS'
  if (event.type in FULFILMENT_LABELS) {
    return `Moved to ${FULFILMENT_LABELS[event.type as FulfilmentStatus]}`
  }
  return event.type
}

function stageName(stage: string | null): string {
  if (!stage) return 'New'
  return FULFILMENT_LABELS[stage as FulfilmentStatus] ?? stage
}

export function OrderDetail({ orderRef }: { orderRef: string }) {
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)

  // Mark-paid form
  const [payOpen, setPayOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [payNote, setPayNote] = useState('')

  const [cancelOpen, setCancelOpen] = useState(false)
  const [note, setNote] = useState('')

  const refresh = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderRef)}`)
        if (res.status === 404) {
          if (!cancelled) setMissing(true)
          return
        }
        if (!res.ok) throw new Error('failed')
        const body: DetailResponse = await res.json()
        if (!cancelled) setData(body)
      } catch {
        if (!cancelled) toast.error('Could not load this order')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderRef, reloadKey])

  /** Every action returns the same shape, so one helper handles all of them. */
  const post = async (
    url: string,
    body: unknown,
    fallbackError: string
  ): Promise<Record<string, unknown> | null> => {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error ?? fallbackError)
        // A conflict means the order moved under us — reload so the page stops
        // offering a button that can no longer work.
        if (res.status === 409) refresh()
        return null
      }
      return json
    } catch {
      toast.error('Network error')
      return null
    } finally {
      setBusy(false)
    }
  }

  const moveStage = async (stage: FulfilmentStage) => {
    const result = await post(
      `/api/admin/orders/${encodeURIComponent(orderRef)}/status`,
      { action: 'set_stage', stage },
      'Could not move this order'
    )
    if (!result) return
    toast.success(`${orderRef} — ${FULFILMENT_LABELS[stage].toLowerCase()}`, {
      description: describeDelivery(result),
    })
    refresh()
  }

  const addNote = async () => {
    const trimmed = note.trim()
    if (!trimmed) return
    const result = await post(
      `/api/admin/orders/${encodeURIComponent(orderRef)}/status`,
      { action: 'note', note: trimmed },
      'Could not save the note'
    )
    if (!result) return
    setNote('')
    toast.success('Note added')
    refresh()
  }

  const dismissRequest = async () => {
    const result = await post(
      `/api/admin/orders/${encodeURIComponent(orderRef)}/status`,
      { action: 'dismiss_cancel_request' },
      'Could not dismiss the request'
    )
    if (!result) return
    toast.success('Cancel request dismissed')
    refresh()
  }

  const confirmPay = async () => {
    const result = await post(
      `/api/admin/orders/${encodeURIComponent(orderRef)}/settle`,
      { action: 'pay', method, reference, receivedBy, note: payNote },
      'Could not record the payment'
    )
    if (!result) return
    setPayOpen(false)
    setReference('')
    setReceivedBy('')
    setPayNote('')
    toast.success(
      `${formatLkr(Number(result.donationTotal ?? 0))} added to the fund — ${orderRef} marked paid`
    )
    refresh()
  }

  const confirmCancel = async () => {
    const result = await post(
      `/api/admin/orders/${encodeURIComponent(orderRef)}/settle`,
      { action: 'cancel' },
      'Could not cancel this order'
    )
    if (!result) return
    setCancelOpen(false)
    const removed = Number(result.donationRemoved ?? 0)
    toast.success(
      removed > 0
        ? `Order cancelled — public total reduced by ${formatLkr(removed)}`
        : 'Order cancelled — its seats are free again'
    )
    refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (missing || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No order with the reference <span className="font-mono">{orderRef}</span>.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { order, events, messages } = data
  const stageIndex = FULFILMENT_ORDER.indexOf(order.fulfillment)

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold font-mono">{order.orderRef}</h1>
        <PaymentBadge status={order.status} />
        <FulfilmentBadge status={order.fulfillment} paymentStatus={order.status} />
        {order.cancelRequestedAt && <CancelRequestedBadge />}
        {order.isStale && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <AlertTriangle className="size-3" /> Waiting {formatAge(order.ageHours)}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          Placed {format(new Date(order.createdAt), 'd MMM yyyy, HH:mm')}
        </span>
      </div>

      {/* The flag has to be impossible to miss: it is the one state on this page
          that is a customer waiting on a decision. */}
      {order.cancelRequestedAt && (
        <Card className="border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  The customer asked to cancel this order
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
                  Asked on{' '}
                  {format(new Date(order.cancelRequestedAt), 'd MMM yyyy, HH:mm')}. Nothing has
                  been cancelled
                  {order.status === 'paid'
                    ? ' — this one is paid, so it is a refund decision. Call them, then either cancel the order or dismiss this.'
                    : ' — no money has been recorded, so cancelling costs nothing.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={dismissRequest}>
                Dismiss request
              </Button>
              {order.canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban className="size-4" /> Cancel the order instead
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {order.canPay && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-500"
            disabled={busy}
            onClick={() => setPayOpen(true)}
          >
            <CheckCircle2 className="size-4" /> Record payment
          </Button>
        )}
        {order.canCancel && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => setCancelOpen(true)}
          >
            <Ban className="size-4" /> Cancel order
          </Button>
        )}
        {order.customer.phone && (
          <Button variant="outline" asChild>
            <a href={`tel:${order.customer.phone}`}>
              <Phone className="size-4" /> Call customer
            </a>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Lines */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What they ordered</CardTitle>
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
                    {line.status === 'cancelled' && (
                      <span className="text-[11px] text-muted-foreground">cancelled</span>
                    )}
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
            </CardContent>
          </Card>

          {/* Money */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments received</CardTitle>
            </CardHeader>
            <CardContent>
              {order.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing recorded yet. The donation is not in the public total until a payment
                  is recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {order.payments.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-x-3">
                        <strong className="tabular-nums">{formatLkr(p.amount)}</strong>
                        <span className="text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {format(new Date(p.receivedAt), 'd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.reference ? `Ref ${p.reference}` : 'No reference'}
                        {p.receivedBy ? ` · taken by ${p.receivedBy}` : ''}
                      </div>
                      {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Passes */}
          {order.vouchers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="size-4 text-emerald-600" /> Workshop passes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {order.vouchers.map((v) => (
                    <div
                      key={v.code}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="font-mono">{v.code}</span>
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          VOUCHER_STYLES[v.status] ?? 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {order.vouchers.filter((v) => v.status === 'redeemed').length} of{' '}
                  {order.vouchers.length} redeemed.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.map((event) => {
                  const Icon = EVENT_ICONS[event.type] ?? StickyNote
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="mt-0.5 size-6 shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <Icon className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium">{eventLabel(event)}</span>
                          <span className="text-xs text-muted-foreground">
                            {ACTOR_LABELS[event.actor] ?? event.actor} ·{' '}
                            {format(new Date(event.createdAt), 'd MMM yyyy, HH:mm')}
                          </span>
                        </div>
                        {event.note && (
                          <p className="text-sm text-muted-foreground mt-0.5 break-words">
                            {event.note}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Note composer */}
              <div className="mt-5 space-y-2 border-t pt-4">
                <Label htmlFor="order-note">Add an internal note</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="order-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Customer will collect on Saturday"
                    maxLength={500}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        addNote()
                      }
                    }}
                  />
                  <Button variant="outline" disabled={busy || !note.trim()} onClick={addNote}>
                    <StickyNote className="size-4" /> Add note
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Notes are for the office — the customer is never sent one.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SMS history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="size-4 text-emerald-600" /> Messages to this customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing has been sent for this order yet. A message is queued when the order is
                  placed, paid, cancelled, or moved along.
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className="rounded-lg border px-3 py-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {TEMPLATE_LABELS[m.template] ?? m.template}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            STATUS_STYLES[m.status] ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {STATUS_LABELS[m.status] ?? m.status}
                        </span>
                        {m.deliveryStatus && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              DELIVERY_STYLES[m.deliveryStatus] ?? 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {DELIVERY_LABELS[m.deliveryStatus] ?? m.deliveryStatus}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {format(new Date(m.sentAt ?? m.createdAt), 'd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                      {m.error && <p className="text-xs text-destructive">{m.error}</p>}
                      {m.sentBy === 'auto' && (
                        <p className="text-[11px] text-muted-foreground">Sent automatically</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-medium">{order.customer.name ?? 'Name not given'}</div>
              {order.customer.phone ? (
                <a
                  href={`tel:${order.customer.phone}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Phone className="size-3.5" /> {order.customer.phone}
                </a>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No mobile on file — the customer cannot be texted about this order.
                </p>
              )}
              {order.customer.email && (
                <div className="text-muted-foreground">{order.customer.email}</div>
              )}
              {order.link?.revokedAt && (
                <p className="text-xs text-destructive">
                  Their receipt link was revoked. They cannot open the receipt or their passes.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pipeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* The four stages as a vertical list — a stepper that keeps its
                  labels is worth more than a row of dots that has to be decoded. */}
              <ol className="space-y-2">
                {FULFILMENT_ORDER.map((stage, index) => {
                  const done = order.status === 'paid' && index <= stageIndex
                  return (
                    <li key={stage} className="flex items-center gap-2 text-sm">
                      <span
                        className={`size-2.5 rounded-full shrink-0 ${
                          done ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                        }`}
                      />
                      <span className={done ? 'font-medium' : 'text-muted-foreground'}>
                        {FULFILMENT_LABELS[stage]}
                      </span>
                      {index === stageIndex && order.status === 'paid' && (
                        <span className="ml-auto text-[11px] text-muted-foreground">now</span>
                      )}
                    </li>
                  )
                })}
              </ol>

              {order.status !== 'paid' ? (
                <p className="text-xs text-muted-foreground border-t pt-3">
                  {order.status === 'cancelled'
                    ? 'This order was cancelled, so it has no pipeline.'
                    : `Record the payment before moving the order along — ${
                        order.status === 'mixed' ? 'some of it is still unpaid' : 'it is unpaid'
                      }, and the customer's receipt would contradict us.`}
                </p>
              ) : order.allowedStages.length === 0 ? (
                <p className="text-xs text-muted-foreground border-t pt-3">
                  Nothing left to move.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {order.allowedStages.map((stage) => {
                    const reverting = FULFILMENT_ORDER.indexOf(stage) < stageIndex
                    return (
                      <Button
                        key={stage}
                        size="sm"
                        variant={reverting ? 'ghost' : 'outline'}
                        disabled={busy}
                        onClick={() => moveStage(stage)}
                        title={
                          reverting
                            ? 'Correct a wrong move — no message is sent'
                            : 'The customer is texted'
                        }
                      >
                        {reverting && <Undo2 className="size-3.5" />}
                        {FULFILMENT_LABELS[stage]}
                        {!reverting && <Send className="size-3.5 text-muted-foreground" />}
                      </Button>
                    )
                  })}
                </div>
              )}
              {order.status === 'paid' && order.allowedStages.some((s) => !isBack(order.fulfillment, s)) && (
                <p className="text-[11px] text-muted-foreground">
                  Moving forward queues a text message to the customer.
                </p>
              )}
              {order.fulfillmentAt && (
                <p className="text-[11px] text-muted-foreground border-t pt-3">
                  Last moved {format(new Date(order.fulfillmentAt), 'd MMM yyyy, HH:mm')}
                </p>
              )}
            </CardContent>
          </Card>

          {order.isStale && (
            <Card className="border-amber-300 dark:border-amber-900">
              <CardContent className="pt-6 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  This order has been waiting {formatAge(order.ageHours)} — over the{' '}
                  {STALE_PENDING_HOURS}h the shop treats as urgent.
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Mark paid */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment for {order.orderRef}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount received</span>
                <strong className="tabular-nums">{formatLkr(order.total)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Added to the fund</span>
                <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatLkr(order.donationTotal)}
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
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmPay}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel — says exactly what it does to the public number */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {order.orderRef}?</AlertDialogTitle>
            <AlertDialogDescription>
              {order.status === 'paid' || order.status === 'mixed' ? (
                <>
                  This order was already paid, so the public donation total will drop by up to{' '}
                  <strong>{formatLkr(order.donationTotal)}</strong>. The payment record is kept —
                  cancelling is a refund question, not a reason to erase that money arrived. The
                  seats/stock it held are released, and the customer is texted.
                </>
              ) : (
                <>
                  This releases the seats/stock the order was holding. Nothing has been added to
                  the public total yet, so it will not change. The customer is texted.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmCancel}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** True when `stage` sits before `from` in the pipeline — a correction, not news. */
function isBack(from: FulfilmentStatus, stage: FulfilmentStage): boolean {
  return FULFILMENT_ORDER.indexOf(stage) < FULFILMENT_ORDER.indexOf(from)
}

/**
 * What to say about the message the move queued. The honest distinction the admin
 * needs: queued-but-not-sent (no gateway, or the daily cap) is not the same as
 * sent, and neither is the same as "no mobile on file". A step back is a fourth
 * case — nothing was queued because nothing should be, which is not a fault
 * anywhere and must not be reported as one.
 */
function describeDelivery(result: Record<string, unknown>): string {
  const message = result.message as { status?: string } | undefined
  const delivery = result.delivery as { sent?: number; held?: number; reason?: string } | undefined

  if (message?.status === 'reverted') return 'Moved back — no message sent.'
  if (message?.status === 'no_phone') return 'No mobile on file — nothing was queued.'
  if (message?.status === 'duplicate') return 'The customer already had this message.'
  if (delivery?.sent) return 'Customer texted.'
  if (delivery?.held) return `Message queued — held back: ${delivery.reason ?? 'not sent yet'}.`
  return `Message queued, not sent: ${delivery?.reason ?? 'no gateway is sending'}.`
}

function BackLink() {
  return (
    <Link
      href="/admin/orders"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> All orders
    </Link>
  )
}

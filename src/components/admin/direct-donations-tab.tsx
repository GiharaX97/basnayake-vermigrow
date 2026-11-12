'use client'

import { useEffect, useState } from 'react'
import { formatLkr } from '@/lib/currency'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { HeartHandshake, Loader2, Plus, Trash2, Check } from 'lucide-react'

interface Donation {
  id: string
  amount: number
  method: string
  donorName: string | null
  note: string | null
  status: string
  createdAt: string
  payments: { method: string; reference: string | null; receivedBy: string | null }[]
}

interface DonationsResponse {
  donations: Donation[]
  totalDonated: number
  donationCount: number
}

/**
 * Gifts with no purchase — the customer who hands over money and takes nothing.
 *
 * These cannot live on `Sale` (its `productId` is required), which is why they
 * have their own table and their own ledger channel.
 */
export function DirectDonationsTab({ onSettled }: { onSettled?: () => void }) {
  const [data, setData] = useState<DonationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Donation | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<Donation | null>(null)
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>('bank_transfer')
  const [receiving, setReceiving] = useState(false)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [donorName, setDonorName] = useState('')
  const [donorPhone, setDonorPhone] = useState('')
  const [note, setNote] = useState('')

  const refresh = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/donations')
        if (!res.ok) throw new Error('failed')
        const body: DonationsResponse = await res.json()
        if (!cancelled) setData(body)
      } catch {
        if (!cancelled) toast.error('Could not load donations')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const record = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, donorName, donorPhone, note }),
      })
      const body = await res.json()
      if (!res.ok) {
        const firstField = body?.details ? Object.values(body.details)[0] : null
        const detail = Array.isArray(firstField) ? String(firstField[0]) : null
        toast.error(detail ?? body?.error ?? 'Could not record this donation')
        return
      }
      toast.success(
        `${formatLkr(body.amount)} added to the fund` +
          (donorPhone.trim() ? ' — thank-you message queued' : '')
      )
      setAmount('')
      setDonorName('')
      setDonorPhone('')
      setNote('')
      refresh()
      onSettled?.()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (donation: Donation) => {
    const res = await fetch(`/api/admin/donations/${donation.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`Removed ${formatLkr(donation.amount)} from the public total`)
      refresh()
      onSettled?.()
    } else {
      toast.error('Could not remove this donation')
    }
    setDeleteTarget(null)
  }

  /**
   * Turn a public pledge into money. Nothing is counted until this runs: the
   * public form writes a 'pending' row, and only an admin who has the cash or
   * has seen the transfer may confirm it.
   */
  const receive = async () => {
    if (!receiveTarget) return
    setReceiving(true)
    try {
      const res = await fetch(`/api/admin/donations/${receiveTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'receive', method: receiveMethod }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not confirm this gift')
        return
      }
      toast.success(
        `${formatLkr(receiveTarget.amount)} added to the fund` +
          (receiveTarget.donorName ? ' and the Direct gifts wall' : '')
      )
      setReceiveTarget(null)
      refresh()
      onSettled?.()
    } catch {
      toast.error('Network error')
    } finally {
      setReceiving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const donations = data?.donations ?? []
  const pendingDonations = donations.filter((d) => d.status === 'pending')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <HeartHandshake className="size-4 text-emerald-600" /> Given without a purchase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatLkr(data?.totalDonated ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            From {data?.donationCount ?? 0} {data?.donationCount === 1 ? 'gift' : 'gifts'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record a gift</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={record} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="don-amount">Amount (LKR)</Label>
              <Input
                id="don-amount"
                type="number"
                min={1}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="don-method">Received by</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger id="don-method" className="w-full">
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
              <Label htmlFor="don-name">Donor name (optional)</Label>
              <Input
                id="don-name"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="Leave blank for anonymous"
                maxLength={120}
              />
            </div>
            {/* Optional: only used to send a thank-you. Never shown publicly —
                GET /api/donations does not return it. */}
            <div className="space-y-1.5">
              <Label htmlFor="don-phone">Mobile (optional)</Label>
              <Input
                id="don-phone"
                type="tel"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
                placeholder="07X XXX XXXX"
                maxLength={20}
              />
            </div>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Record
            </Button>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="don-note">Note (optional)</Label>
              <Input
                id="don-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Recorded gifts count toward the public total immediately — use this only once the money
            is in hand or the transfer has cleared.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent gifts</CardTitle>
        </CardHeader>
        <CardContent>
          {donations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gifts recorded yet.</p>
          ) : (
            <>
              {pendingDonations.length > 0 && (
                <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {pendingDonations.length} web pledge
                  {pendingDonations.length === 1 ? '' : 's'} waiting. Nothing is counted for them
                  until you confirm the money arrived.
                </p>
              )}
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.map((d) => (
                  <TableRow key={d.id} className={d.status !== 'paid' ? 'opacity-60' : undefined}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(d.createdAt), 'd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell>{d.donorName ?? 'Anonymous'}</TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[d.method as PaymentMethod] ?? d.method}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                      {formatLkr(d.amount)}
                    </TableCell>
                    <TableCell>
                      {d.status === 'paid' ? (
                        'Counted'
                      ) : d.status === 'pending' ? (
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          Awaiting money
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Removed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => {
                            setReceiveTarget(d)
                            setReceiveMethod('bank_transfer')
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                          aria-label="Confirm this gift was received"
                        >
                          <Check className="size-3.5" /> Confirm
                        </button>
                      )}
                      {d.status === 'paid' && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(d)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remove donation"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this gift?</AlertDialogTitle>
            <AlertDialogDescription>
              The public donation total will drop by{' '}
              <strong>{formatLkr(deleteTarget?.amount ?? 0)}</strong>. The record stays in this list
              marked as removed, so the fund&rsquo;s history remains auditable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && remove(deleteTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={receiveTarget !== null} onOpenChange={(o) => !o && setReceiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this gift?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that {receiveTarget?.donorName ?? 'the donor'}&rsquo;s gift of{' '}
              <strong>{formatLkr(receiveTarget?.amount ?? 0)}</strong> has been received. It will be
              added to the public total and, if a name was given, to the Direct gifts wall.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="receive-method">How did the money arrive?</Label>
            <Select
              value={receiveMethod}
              onValueChange={(v) => setReceiveMethod(v as PaymentMethod)}
            >
              <SelectTrigger id="receive-method" className="w-full">
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
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={receiving}
              onClick={(e) => {
                // Keep the dialog open while the request runs; `receive` closes
                // it only after the server has committed the money.
                e.preventDefault()
                receive()
              }}
            >
              {receiving ? 'Confirming…' : 'Confirm received'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

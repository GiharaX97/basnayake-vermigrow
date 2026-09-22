'use client'

import { useEffect, useState } from 'react'
import { formatLkr } from '@/lib/currency'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/payments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Loader2, Receipt } from 'lucide-react'

interface Payment {
  id: string
  amount: number
  method: string
  reference: string | null
  receivedBy: string | null
  note: string | null
  receivedAt: string
  orderRef: string | null
  sale: {
    id: string
    orderRef: string | null
    retailer: string
    customerName: string | null
    product: { name: string }
  } | null
  donation: { id: string; donorName: string | null } | null
}

/**
 * The money-receipt audit trail: every event where money changed hands.
 *
 * Deliberately a flat, append-mostly list rather than something derived from
 * sales — one order is settled by ONE receipt no matter how many lines it has,
 * and a cancelled order keeps its receipt (the money really did arrive; how it
 * was returned is a separate question). Summing this answers "what did we
 * actually receive", which is a different question from what the wall shows.
 */
export function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/payments')
        if (!res.ok) throw new Error('failed')
        const body = await res.json()
        if (!cancelled) setPayments(body.payments ?? [])
      } catch {
        if (!cancelled) toast.error('Could not load payments')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const total = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Receipt className="size-4 text-emerald-600" /> Received (latest {payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatLkr(total)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Every receipt recorded, whatever it was for
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No money recorded yet. Marking an order paid, or recording a gift, creates a receipt
              here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Taken by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(p.receivedAt), 'd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.reference ?? '—'}</TableCell>
                    <TableCell>
                      {p.donation ? (
                        <>Gift from {p.donation.donorName ?? 'anonymous'}</>
                      ) : p.orderRef ? (
                        <span className="font-mono text-xs">{p.orderRef}</span>
                      ) : p.sale ? (
                        <>
                          {p.sale.product.name} — {p.sale.retailer}
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.receivedBy ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatLkr(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

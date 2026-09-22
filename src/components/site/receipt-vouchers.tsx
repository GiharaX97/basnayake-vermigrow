'use client'

import { useState } from 'react'
import QRCode from 'qrcode'
import { KeyRound, Loader2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { revealVouchers, type RevealedVoucher } from '@/lib/receipt-actions'

/**
 * The gate in front of the workshop voucher codes.
 *
 * The codes are NOT in the page HTML — they arrive only from the server action
 * once the order reference matches. See src/lib/receipt-actions.ts for why that
 * matters (a fetch here redeems a seat on its first scan).
 *
 * The customer already has the reference: it was shown on the confirmation
 * screen and sent in the order-placed message. The email-style "enter your
 * reference" step is the price of not putting a redeem-capable code on a bare
 * URL.
 */
export function ReceiptVouchers({ token }: { token: string }) {
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [vouchers, setVouchers] = useState<RevealedVoucher[] | null>(null)
  const [qrByCode, setQrByCode] = useState<Record<string, string>>({})

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await revealVouchers(token, reference)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setVouchers(result.vouchers)
      // QR is drawn in the browser from the origin the customer is actually on,
      // matching how the admin QR tab works — so a link opened on the local dev
      // port does not encode the production host.
      const entries = await Promise.all(
        result.vouchers.map(async (v) => {
          const url = `${window.location.origin}/donations?c=${v.code}`
          const dataUrl = await QRCode.toDataURL(url, {
            width: 512,
            margin: 2,
            color: { dark: '#065f46', light: '#ffffff' },
          })
          return [v.code, dataUrl] as const
        })
      )
      setQrByCode(Object.fromEntries(entries))
    } catch {
      setError('We could not open your passes. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (vouchers) {
    if (vouchers.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No workshop passes are attached to this order.
        </p>
      )
    }
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Show the matching code at the workshop. Each one works once.
        </p>
        {vouchers.map((v) => (
          <div key={v.code} className="rounded-xl border bg-card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {qrByCode[v.code] ? (
                <img
                  src={qrByCode[v.code]}
                  alt={`QR code for pass ${v.code}`}
                  className="h-36 w-36 shrink-0 rounded-lg border bg-white p-1.5"
                />
              ) : (
                <div className="h-36 w-36 shrink-0 rounded-lg border bg-muted grid place-items-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <QrCode className="size-3.5" /> Workshop pass
                </div>
                <div className="font-mono text-lg font-semibold break-all">{v.code}</div>
                {v.holderName && <div className="text-sm text-muted-foreground">{v.holderName}</div>}
                {v.redeemed && (
                  <div className="text-sm font-medium text-amber-700 dark:text-amber-500">
                    Already used at the workshop
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="receipt-ref">Your order reference</Label>
        <Input
          id="receipt-ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="VG-O-XXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono"
          required
        />
        <p className="text-xs text-muted-foreground">
          It is on your booking confirmation — we also sent it when you placed the order.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={busy || reference.trim().length === 0}
        className="bg-emerald-600 hover:bg-emerald-500"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Show my passes
      </Button>
    </form>
  )
}

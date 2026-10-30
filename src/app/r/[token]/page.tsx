import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatLkr } from '@/lib/currency'
import { maskPhone } from '@/lib/notify'
import { prisma } from '@/lib/prisma'
import { ReceiptVouchers } from '@/components/site/receipt-vouchers'

/**
 * The customer's own record of what they did — the first per-record public page
 * in this codebase. Every other public surface (/, /order, /donations) is an
 * aggregate; this one is addressed to a single person, so it is built
 * defensively:
 *
 *   - keyed on an unguessable CSPRNG token, never on an order reference or a
 *     pack code (both are short, one is printed on stickers, and neither is a
 *     secret worth betting a customer's booking on)
 *   - the token is looked up EXACTLY as received. Every other code lookup in this
 *     app normalises with .toUpperCase(); base64url is mixed-case and doing that
 *     here would break most links.
 *   - unknown, expired and revoked all render the SAME 404. Distinguishing them
 *     would confirm to a guesser that a token exists.
 *   - phone numbers are masked
 *   - no caching, no indexing, no referrer — set in next.config.ts for /r/*
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your receipt · Basnayaka Vermigrow',
  // Paired with the X-Robots-Tag header in next.config.ts. Not redundant: the
  // config entry covers the whole /r/ path including anything added later, this
  // survives the config entry being lost in a refactor.
  robots: { index: false, follow: false, nocache: true },
}

/* ------------------------------------------------------------------ load -- */

type View =
  | {
      kind: 'order'
      ref: string
      status: 'pending' | 'paid' | 'cancelled'
      placedAt: Date
      customerName: string | null
      customerPhone: string | null
      total: number
      donation: number
      lines: { id: string; name: string; quantity: number; unitPrice: number; unit: string }[]
      hasVouchers: boolean
    }
  | { kind: 'pack'; code: string; product: string; amount: number; status: string; at: Date }
  | { kind: 'gift'; amount: number; method: string; at: Date; name: string | null }
  | {
      kind: 'sale'
      name: string
      quantity: number
      unitPrice: number
      total: number
      donation: number
      at: Date
      customerName: string | null
    }

/**
 * Resolve a token to something renderable, or nothing at all.
 *
 * Every failure path returns null so the page cannot accidentally tell a guesser
 * which way they were wrong.
 */
async function loadView(token: string): Promise<View | null> {
  const link = await prisma.customerLink.findUnique({ where: { token } })
  if (!link || link.revokedAt) return null
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) return null

  if (link.refType === 'order') {
    const lines = await prisma.sale.findMany({
      where: { orderRef: link.refId },
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (lines.length === 0) return null

    // An order's lines always share a status: the settle route moves all of them
    // in one transaction, so a mixed order is not a reachable state. Read it as
    // "all or nothing" rather than trusting the first row, so that if a mixed
    // state ever did appear the page understates rather than overstates payment.
    const status: 'pending' | 'paid' | 'cancelled' = lines.every((l) => l.status === 'paid')
      ? 'paid'
      : lines.every((l) => l.status === 'cancelled')
        ? 'cancelled'
        : 'pending'

    return {
      kind: 'order',
      ref: link.refId,
      status,
      placedAt: lines[0].createdAt,
      customerName: lines[0].customerName,
      customerPhone: lines[0].customerPhone,
      total: lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
      donation: lines.reduce((sum, l) => sum + l.donationAmount, 0),
      lines: lines.map((l) => ({
        id: l.id,
        name: l.product.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        unit: l.product.unit,
      })),
      // Only ever true once the order is paid — the settle route is the only
      // writer of Pack.orderRef, and it writes them in the payment transaction.
      hasVouchers: status === 'paid' && (await prisma.pack.count({ where: { orderRef: link.refId } })) > 0,
    }
  }

  if (link.refType === 'pack') {
    const pack = await prisma.pack.findUnique({
      where: { id: link.refId },
      include: { product: { select: { name: true } } },
    })
    if (!pack) return null
    return {
      kind: 'pack',
      code: pack.code,
      product: pack.product.name,
      amount: pack.donationAmount,
      status: pack.status,
      at: pack.soldAt ?? pack.redeemedAt ?? pack.createdAt,
    }
  }

  if (link.refType === 'donation') {
    const gift = await prisma.donation.findUnique({ where: { id: link.refId } })
    if (!gift) return null
    return {
      kind: 'gift',
      amount: gift.amount,
      method: gift.method,
      at: gift.createdAt,
      name: gift.donorName,
    }
  }

  const sale = await prisma.sale.findUnique({
    where: { id: link.refId },
    include: { product: { select: { name: true } } },
  })
  if (!sale) return null
  return {
    kind: 'sale',
    name: sale.product.name,
    quantity: sale.quantity,
    unitPrice: sale.unitPrice,
    total: sale.unitPrice * sale.quantity,
    donation: sale.donationAmount,
    at: sale.paidAt ?? sale.createdAt,
    customerName: sale.customerName,
  }
}

/* ------------------------------------------------------------------ view -- */

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  reload: 'Reload',
  other: 'Other',
}

const PACK_STATUS_LABELS: Record<string, string> = {
  in_warehouse: 'In the warehouse',
  dispatched: 'On its way',
  sold: 'Sold',
  issued: 'Ready to use',
  redeemed: 'Used',
}

function Row({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold tabular-nums text-right' : 'text-right'}>{value}</span>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-5 space-y-3">{children}</div>
}

/** The amount that reached Apeksha Hospital, shown the same way everywhere. */
function FundLine({ amount }: { amount: number }) {
  if (amount <= 0) return null
  return (
    <Row
      label="To Apeksha Hospital"
      value={
        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatLkr(amount)}
        </span>
      }
    />
  )
}

function Body({ view, token }: { view: View; token: string }) {
  if (view.kind === 'order') {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Your order</h1>
        <p className="mt-2 text-muted-foreground">
          {view.status === 'paid'
            ? 'Paid — thank you. Everything below is yours to keep.'
            : view.status === 'cancelled'
              ? 'This order was cancelled. Nothing is owed.'
              : 'We have your order and will call you to arrange payment.'}
        </p>

        <Panel>
          <Row label="Reference" value={<span className="font-mono font-semibold">{view.ref}</span>} />
          <Row label="Placed" value={view.placedAt.toLocaleDateString('en-LK', { dateStyle: 'medium' })} />
          <Row
            label="Status"
            value={
              view.status === 'paid' ? (
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Paid</span>
              ) : view.status === 'cancelled' ? (
                <span className="font-medium text-destructive">Cancelled</span>
              ) : (
                <span className="font-medium text-amber-700 dark:text-amber-500">Awaiting payment</span>
              )
            }
          />
          {view.customerName && <Row label="Name" value={view.customerName} />}
          {/* Masked deliberately: this page travels over SMS and gets forwarded.
              The customer knows their own number, so the full value buys them
              nothing and costs plenty if the link leaks. */}
          {view.customerPhone && <Row label="Phone" value={<span className="font-mono">{maskPhone(view.customerPhone)}</span>} />}
        </Panel>

        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            What you ordered
          </h2>
          <Panel>
            {view.lines.map((line) => (
              <Row
                key={line.id}
                label={
                  <>
                    {line.name}
                    {line.unit ? <span className="text-muted-foreground"> · {line.unit}</span> : null}
                    <span className="text-muted-foreground"> × {line.quantity}</span>
                  </>
                }
                value={formatLkr(line.unitPrice * line.quantity)}
              />
            ))}
            <div className="border-t pt-3 space-y-3">
              <Row label="Total" value={formatLkr(view.total)} strong />
              <FundLine amount={view.donation} />
            </div>
          </Panel>
          {view.status !== 'paid' && view.donation > 0 && (
            <p className="text-xs text-muted-foreground">
              The donation total updates once we have received your payment — that keeps the
              public wall honest.
            </p>
          )}
        </div>

        {view.hasVouchers && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Your workshop passes
            </h2>
            <Panel>
              <ReceiptVouchers token={token} />
            </Panel>
          </div>
        )}
      </>
    )
  }

  if (view.kind === 'pack') {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Thank you for your pack</h1>
        <p className="mt-2 text-muted-foreground">
          Your pack of {view.product} added to Apeksha Hospital.
        </p>
        <Panel>
          <Row label="Pack code" value={<span className="font-mono font-semibold">{view.code}</span>} />
          <Row label="Product" value={view.product} />
          <Row label="Added to Apeksha Hospital" value={formatLkr(view.amount)} strong />
          <Row label="Status" value={PACK_STATUS_LABELS[view.status] ?? view.status} />
          <Row label="Date" value={view.at.toLocaleDateString('en-LK', { dateStyle: 'medium' })} />
        </Panel>
      </>
    )
  }

  if (view.kind === 'gift') {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          {view.name ? `Thank you, ${view.name}` : 'Thank you for your gift'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your gift went straight to Apeksha Hospital. This is your record of it.
        </p>
        <Panel>
          <Row label="Amount" value={formatLkr(view.amount)} strong />
          <Row label="Method" value={METHOD_LABELS[view.method] ?? view.method} />
          <Row label="Date" value={view.at.toLocaleDateString('en-LK', { dateStyle: 'medium' })} />
        </Panel>
      </>
    )
  }

  // "Total LKR 0" is not a total, it is a missing catalog price, and on a
  // receipt it reads as "this was free" — the same lie the sale route's
  // unitPrice snapshot exists to prevent. A counter sale can still land here at
  // 0 if nobody has set the price yet, so the row is dropped rather than printed
  // false. The fund line is the honest number either way, and it still gets its
  // rule even when there is no total above it.
  const showTotal = view.total > 0

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Your purchase</h1>
      <p className="mt-2 text-muted-foreground">
        Recorded at our store. Thank you for buying from us.
      </p>
      <Panel>
        {view.customerName && <Row label="Name" value={view.customerName} />}
        <Row
          label={
            <>
              {view.name}
              <span className="text-muted-foreground"> × {view.quantity}</span>
            </>
          }
          value={showTotal ? formatLkr(view.total) : '—'}
        />
        {(showTotal || view.donation > 0) && (
          <div className="border-t pt-3 space-y-3">
            {showTotal && <Row label="Total" value={formatLkr(view.total)} strong />}
            <FundLine amount={view.donation} />
          </div>
        )}
        <Row label="Date" value={view.at.toLocaleDateString('en-LK', { dateStyle: 'medium' })} />
      </Panel>
    </>
  )
}

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const view = await loadView(token)
  if (!view) notFound()
  // notFound() is typed as void in this Next version, so the null branch is
  // narrowed explicitly rather than relying on the return type being `never`.
  const receipt = view as View

  return (
    // A deliberately minimal shell rather than the site's <Navbar/>: that navbar
    // is `fixed` and styled to sit transparently over the home page hero, and it
    // would be the only thing on this page pulling in the content store. A
    // private receipt is not a browsing surface — one link home is enough.
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm overflow-hidden">
              <img src="/logos/logo-main.png" alt="" className="h-full w-full object-contain p-0.5" />
            </span>
            <span className="font-semibold tracking-tight">Basnayaka Vermigrow</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <Body view={receipt} token={token} />

        <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">
          Keep this link private — it is your personal record. If you need help, call us and
          quote your reference. You can also{' '}
          <a href="/donations" className="text-emerald-700 dark:text-emerald-400 hover:underline">
            see the donation wall
          </a>
          .
        </p>
      </main>
    </div>
  )
}

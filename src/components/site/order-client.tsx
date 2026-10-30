'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  HeartHandshake,
  MapPin,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sprout,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Navbar } from '@/components/site/navbar'
import { NoticeTicker } from '@/components/site/notice-ticker'
import { Footer } from '@/components/site/footer'
import { formatLkr } from '@/lib/currency'
import type { CatalogItem } from '@/lib/catalog'

/**
 * The public ordering page.
 *
 * Money is entirely offline (cash at the store, or a bank transfer), so this
 * form does not take payment — it records what the customer wants, and the farm
 * confirms the money when it arrives. That is why the confirmation panel says
 * "we will call you" rather than "paid": claiming otherwise would be a lie.
 */

const MAX_PRODUCT_QTY = 50
const MAX_SERVICE_QTY = 10

interface PlacedOrder {
  orderRef: string
  total: number
  donationTotal: number
  /**
   * Key to the customer's receipt at /r/<token>. Null when we have no phone to
   * message them on — in that case the link is never delivered either, so there
   * is nothing to show. See src/lib/notify.ts.
   */
  receiptToken: string | null
  /** Whether the server is willing to start a card payment for this order. */
  cardPayment: boolean
}

export function OrderClient({ initialItems }: { initialItems: CatalogItem[] }) {
  const [items, setItems] = React.useState<CatalogItem[]>(initialItems)
  const [cart, setCart] = React.useState<Record<string, number>>({})
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [note, setNote] = React.useState('')
  // Honeypot. Hidden from humans; a bot filling every field trips it. Sent to the
  // server empty — the server rejects a filled one.
  const [website, setWebsite] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [placed, setPlaced] = React.useState<PlacedOrder | null>(null)

  const products = items.filter((i) => i.kind !== 'service')
  const services = items.filter((i) => i.kind === 'service')

  /** Hard ceiling for one item: stock is unlimited, seats are not. */
  const maxFor = React.useCallback((item: CatalogItem) => {
    if (item.kind !== 'service') return MAX_PRODUCT_QTY
    const seats = item.remainingSeats ?? MAX_SERVICE_QTY
    return Math.max(0, Math.min(seats, MAX_SERVICE_QTY))
  }, [])

  const setQty = (item: CatalogItem, next: number) => {
    const cap = maxFor(item)
    const clamped = Math.max(0, Math.min(next, cap))
    setCart((prev) => {
      const copy = { ...prev }
      if (clamped === 0) delete copy[item.id]
      else copy[item.id] = clamped
      return copy
    })
  }

  const lines = React.useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const item = items.find((i) => i.id === id)
          return item ? { item, quantity } : null
        })
        .filter((l): l is { item: CatalogItem; quantity: number } => l !== null),
    [cart, items]
  )

  const total = lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0)
  const donationTotal = lines.reduce((sum, l) => sum + l.item.donationPerUnit * l.quantity, 0)

  /** Re-read the catalog so seat counts reflect orders placed a moment ago. */
  const refreshCatalog = React.useCallback(async () => {
    try {
      const res = await fetch('/api/catalog', { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      if (Array.isArray(body.items)) setItems(body.items)
    } catch {
      // Keep the numbers we have; the server is still the source of truth.
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      toast.error('Please choose at least one item.')
      return
    }
    if (name.trim().length < 2) {
      toast.error('Please enter your name.')
      return
    }
    if (phone.trim().length < 9) {
      toast.error('Please enter a phone number we can reach you on.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
          note: note.trim(),
          website,
          items: lines.map((l) => ({ productId: l.item.id, quantity: l.quantity })),
        }),
      })

      if (res.status === 409) {
        // Seats ran out (possibly while this form was open). Re-read so the page
        // shows the real remaining count instead of the stale one.
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? 'Those seats are no longer available.')
        setCart({})
        await refreshCatalog()
        return
      }
      if (res.status === 429) {
        toast.error('Too many orders from this connection. Please call us instead.')
        return
      }
      if (res.status === 503) {
        toast.error('We are busy right now — please try again in a moment.')
        return
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not place your order. Please try again.')
        return
      }

      setPlaced({
        orderRef: body.orderRef,
        total: body.total,
        donationTotal: body.donationTotal,
        receiptToken: body.receiptToken ?? null,
        cardPayment: body.cardPayment === true,
      })
      setCart({})
      await refreshCatalog()
      // The confirmation is the content on screen now, so bring it into view.
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast.error('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NoticeTicker />
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
              <ShoppingBag className="size-3.5" />
              Order & book
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight max-w-2xl">
              Order from the farm, or book a workshop seat
            </h1>
            <p className="mt-4 text-base sm:text-lg text-emerald-100 max-w-2xl">
              Place your order here and we will call you to confirm. Pay in cash at
              the store or by bank transfer — and a share of every item and every
              seat goes to Apeksha Hospital.
            </p>
          </div>
        </section>

        {placed ? (
          <PlacedPanel placed={placed} onAnother={() => setPlaced(null)} />
        ) : (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div className="space-y-12">
              <ItemGroup
                title="Products"
                subtitle="Hand-turned vermicompost and live worms, ready to collect or delivered locally."
                items={products}
                cart={cart}
                maxFor={maxFor}
                setQty={setQty}
              />
              <ItemGroup
                title="Workshops & training"
                subtitle="Hands-on sessions at the farm. Book your seat and pay on the day or by transfer."
                items={services}
                cart={cart}
                maxFor={maxFor}
                setQty={setQty}
                showSeats
              />
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed p-10 text-center">
                  <Sprout className="mx-auto size-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nothing is listed for sale just yet. Please check back soon.
                  </p>
                </div>
              )}
            </div>

            <OrderForm
              lines={lines}
              total={total}
              donationTotal={donationTotal}
              name={name}
              setName={setName}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              note={note}
              setNote={setNote}
              website={website}
              setWebsite={setWebsite}
              submitting={submitting}
              onSubmit={submit}
              setQty={setQty}
            />
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}

function ItemGroup({
  title,
  subtitle,
  items,
  cart,
  maxFor,
  setQty,
  showSeats = false,
}: {
  title: string
  subtitle: string
  items: CatalogItem[]
  cart: Record<string, number>
  maxFor: (item: CatalogItem) => number
  setQty: (item: CatalogItem, next: number) => void
  showSeats?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            quantity={cart[item.id] ?? 0}
            cap={maxFor(item)}
            setQty={setQty}
            showSeats={showSeats}
          />
        ))}
      </div>
    </div>
  )
}

function ItemCard({
  item,
  quantity,
  cap,
  setQty,
  showSeats,
}: {
  item: CatalogItem
  quantity: number
  cap: number
  setQty: (item: CatalogItem, next: number) => void
  showSeats: boolean
}) {
  const soldOut = showSeats && item.remainingSeats !== null && item.remainingSeats <= 0
  const disabled = !item.orderable || soldOut
  const checked = quantity > 0

  return (
    <div
      className={`rounded-xl border bg-card p-5 flex flex-col transition-colors ${
        checked ? 'border-emerald-500/60 ring-1 ring-emerald-500/20' : 'border-border/60'
      }`}
    >
      {item.imageUrl && (
        // A plain <img>, matching the rest of the site: this is an
        // admin-supplied URL, not a build-time asset next/image can optimise.
        <img
          src={item.imageUrl}
          alt={item.name}
          className="mb-4 h-36 w-full rounded-lg object-cover"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{item.name}</h3>
        {showSeats && item.remainingSeats !== null && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              soldOut
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
            }`}
          >
            {soldOut ? 'Fully booked' : `${item.remainingSeats} seats left`}
          </span>
        )}
      </div>

      {item.description && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
          {item.description}
        </p>
      )}

      {showSeats && (item.eventDate || item.location) && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {item.eventDate && (
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {new Date(item.eventDate).toLocaleDateString('en-LK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          {item.location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {item.location}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border/40">
        {item.orderable ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold">{formatLkr(item.price)}</span>
            {item.unit && <span className="text-sm text-muted-foreground">{item.unit}</span>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask for price —{' '}
            <Link href="/#contact" className="text-emerald-600 hover:underline">
              contact us
            </Link>
          </p>
        )}
        {item.donationPerUnit > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <HeartHandshake className="size-3.5" />
            {formatLkr(item.donationPerUnit)} per {item.kind === 'service' ? 'seat' : 'unit'} to Apeksha Hospital
          </p>
        )}
      </div>

      <div className="mt-4">
        {disabled ? (
          <Button disabled className="w-full rounded-full" variant="secondary">
            {soldOut ? 'Fully booked' : 'Not available online'}
          </Button>
        ) : quantity > 0 ? (
          <div className="flex items-center justify-between rounded-full border border-border/60 p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setQty(item, quantity - 1)}
              aria-label={`Remove one ${item.name}`}
            >
              <Minus className="size-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setQty(item, quantity + 1)}
              disabled={quantity >= cap}
              aria-label={`Add one more ${item.name}`}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="w-full rounded-full bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
            onClick={() => setQty(item, 1)}
          >
            <Plus className="size-4" />
            {item.kind === 'service' ? 'Book a seat' : 'Add to order'}
          </Button>
        )}
      </div>
    </div>
  )
}

function OrderForm({
  lines,
  total,
  donationTotal,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  note,
  setNote,
  website,
  setWebsite,
  submitting,
  onSubmit,
  setQty,
}: {
  lines: { item: CatalogItem; quantity: number }[]
  total: number
  donationTotal: number
  name: string
  setName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  note: string
  setNote: (v: string) => void
  website: string
  setWebsite: (v: string) => void
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
  setQty: (item: CatalogItem, next: number) => void
}) {
  return (
    <form onSubmit={onSubmit} className="lg:sticky lg:top-24 h-fit space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Your order</h2>

        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing chosen yet. Add a product or book a seat to get started.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {lines.map(({ item, quantity }) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {quantity} × {formatLkr(item.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(item, 0)}
                      className="text-xs text-muted-foreground hover:text-rose-600 underline"
                    >
                      remove
                    </button>
                  </div>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatLkr(item.price * quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 pt-4 border-t space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{formatLkr(total)}</span>
          </div>
          {donationTotal > 0 && (
            <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
              <span className="inline-flex items-center gap-1.5">
                <HeartHandshake className="size-4" />
                To Apeksha Hospital
              </span>
              <span className="font-semibold tabular-nums">{formatLkr(donationTotal)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your details
        </h3>
        <div className="space-y-2">
          <label htmlFor="order-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="order-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nimal Perera"
            maxLength={80}
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="order-phone" className="text-sm font-medium">
            Phone
          </label>
          <Input
            id="order-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07X XXX XXXX"
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="order-email" className="text-sm font-medium">
            Email <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            id="order-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={120}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="order-note" className="text-sm font-medium">
            Note <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="order-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Delivery address, preferred collection time, questions…"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Honeypot: hidden from people, irresistible to bots. Not `type=hidden` —
            some bots skip those — so it is visually and semantically hidden. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="order-website">Website</label>
          <input
            id="order-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          disabled={submitting || lines.length === 0}
          className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-500"
        >
          {submitting ? 'Placing order…' : 'Place order'}
        </Button>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Phone className="size-3.5 shrink-0 mt-0.5" />
          We will call you to confirm and arrange payment — cash at the store or
          bank transfer. Nothing is charged online.
        </p>
      </div>
    </form>
  )
}

/**
 * The receipt link, shown once, on the confirmation screen.
 *
 * This is the ONLY moment the token ever reaches the browser: it is not in the
 * URL, not in a cookie and not in localStorage. The durable copy is the message
 * we send, so this panel exists to cover the gap between placing the order and
 * that message arriving — and to make "keep your reference handy" survivable.
 *
 * No state, deliberately: the absolute URL is built inside the click handler
 * rather than in an effect, because `window` is unavailable during render and an
 * effect setting state here would add to the `react-hooks/set-state-in-effect`
 * baseline (10 errors, all pre-existing).
 */
function ReceiptLink({ token }: { token: string }) {
  const href = `/r/${token}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`)
      toast.success('Receipt link copied')
    } catch {
      toast.error('Could not copy automatically — please open it and bookmark the page')
    }
  }

  return (
    <div className="mt-6 rounded-xl border bg-card p-5 text-left space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ReceiptText className="size-4 text-emerald-600" />
        Your receipt
      </div>
      <p className="text-xs text-muted-foreground">
        Keep this link. Your order lives there, and your workshop passes appear on it
        once we have received payment.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild variant="outline" className="rounded-full">
          <Link href={href}>Open my receipt</Link>
        </Button>
        <Button type="button" variant="ghost" className="rounded-full" onClick={copy}>
          <Copy className="size-4" />
          Copy link
        </Button>
      </div>
    </div>
  )
}

function PlacedPanel({ placed, onAnother }: { placed: PlacedOrder; onAnother: () => void }) {
  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16 text-center">
      <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
      <h2 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight">
        Thank you — your order is with us
      </h2>
      <p className="mt-3 text-muted-foreground">
        {placed.cardPayment
          ? 'Pay securely by card now, or pay in cash at the store — either way we will call you to confirm.'
          : 'We will call you shortly to confirm and arrange payment.'}{' '}
        Please keep your reference handy.
      </p>

      <div className="mt-8 rounded-xl border bg-card p-6 text-left space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Reference</span>
          <span className="font-mono text-sm font-semibold">{placed.orderRef}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Order total</span>
          <span className="font-semibold tabular-nums">{formatLkr(placed.total)}</span>
        </div>
        {placed.donationTotal > 0 && (
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-sm inline-flex items-center gap-1.5">
              <HeartHandshake className="size-4" />
              Going to Apeksha Hospital
            </span>
            <span className="font-semibold tabular-nums">{formatLkr(placed.donationTotal)}</span>
          </div>
        )}
      </div>

      {placed.receiptToken && <ReceiptLink token={placed.receiptToken} />}

      {placed.cardPayment && <CardPayButton orderRef={placed.orderRef} />}

      <p className="mt-6 text-xs text-muted-foreground">
        The donation total only updates once we have received your payment — that keeps
        the public wall honest.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" className="rounded-full" onClick={onAnother}>
          Place another order
        </Button>
        <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-500">
          <Link href="/donations">
            <Users className="size-4" />
            See the donation wall
          </Link>
        </Button>
      </div>
    </section>
  )
}

/**
 * "Pay by card" — sends the order REFERENCE only.
 *
 * The server re-reads the total from the database and opens the hosted
 * Payments.lk checkout. No price, amount or status travels from this component,
 * so a tampered page can change nothing. The customer's card details never touch
 * this site: the provider's page takes them, and only a signed webhook can mark
 * the order paid.
 */
function CardPayButton({ orderRef }: { orderRef: string }) {
  const [busy, setBusy] = React.useState(false)

  const pay = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/payments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderRef }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || typeof body?.url !== 'string') {
        toast.error(body?.error ?? 'Could not start the card payment.')
        return
      }
      // Hosted checkout: the customer leaves this site entirely. The return URL
      // only DISPLAYS state; it never settles anything.
      window.location.href = body.url
    } catch {
      toast.error('Network error. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-5 dark:bg-emerald-950/20">
      <Button
        onClick={pay}
        disabled={busy}
        className="w-full rounded-full bg-emerald-600 hover:bg-emerald-500"
      >
        <CreditCard className="size-4" />
        {busy ? 'Opening secure checkout…' : 'Pay by card now'}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        You will be taken to Payments.lk&apos;s secure checkout. Your card details are never
        entered on, or stored by, this site. Your order is marked paid only after the
        payment is confirmed.
      </p>
    </div>
  )
}

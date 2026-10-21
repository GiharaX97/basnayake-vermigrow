'use client'

import { useEffect, useState } from 'react'
import { formatLkr as fmtLkr } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { format, formatDistanceToNow } from 'date-fns'
import { QrSheetDialog, type QrSheet } from '@/components/admin/qr-sheet-dialog'
import {
  AlertTriangle,
  Boxes,
  Loader2,
  MapPin,
  PackageCheck,
  Printer,
  QrCode,
  Search,
  Send,
  Trash2,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  donationPerUnit: number
  active: boolean
}

interface PackStats {
  stats: { in_warehouse: number; dispatched: number; sold: number }
  flags: {
    rescanned: { id: string; code: string; scanCount: number; status: string; product: { name: string } }[]
    stale: { retailer: string; count: number; oldest: string; products: string[] }[]
    staleDays: number
  }
}

interface DispatchRow {
  id: string
  retailer: string
  note: string | null
  createdAt: string
  totalPacks: number
  soldPacks: number
  products: { name: string; total: number; sold: number }[]
}

interface PackDetail {
  id: string
  code: string
  status: string
  scanCount: number
  donationAmount: number
  createdAt: string
  dispatchedAt: string | null
  soldAt: string | null
  product: { name: string }
  dispatch?: { retailer: string } | null
  scans: { id: string; createdAt: string; userAgent: string | null }[]
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    in_warehouse: { label: 'In warehouse', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    dispatched: { label: 'Dispatched', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
    sold: { label: 'Sold', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' },
  }
  const s = map[status] ?? { label: status, cls: '' }
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

export default function AdminWarehousePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [overview, setOverview] = useState<PackStats | null>(null)
  const [dispatches, setDispatches] = useState<DispatchRow[]>([])
  const [loading, setLoading] = useState(true)

  // Generate form
  const [genProductId, setGenProductId] = useState('')
  const [genQty, setGenQty] = useState('50')
  const [generating, setGenerating] = useState(false)

  // Dispatch form
  const [dispProductId, setDispProductId] = useState('')
  const [dispQty, setDispQty] = useState('50')
  const [dispRetailer, setDispRetailer] = useState('')
  const [dispNote, setDispNote] = useState('')
  const [dispatching, setDispatching] = useState(false)

  // Lookup
  const [lookupCode, setLookupCode] = useState('')
  const [lookupResult, setLookupResult] = useState<PackDetail | null>(null)
  const [lookupNotFound, setLookupNotFound] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  // Print sheet
  const [sheet, setSheet] = useState<QrSheet | null>(null)

  const [deleteDispatchId, setDeleteDispatchId] = useState<string | null>(null)

  const load = async () => {
    try {
      const [productsRes, packsRes, dispatchesRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/packs'),
        fetch('/api/admin/dispatches'),
      ])
      if (productsRes.ok) {
        const list: Product[] = await productsRes.json()
        setProducts(list.filter((p) => p.active))
        setGenProductId((prev) => prev || list.find((p) => p.active)?.id || '')
        setDispProductId((prev) => prev || list.find((p) => p.active)?.id || '')
      }
      if (packsRes.ok) setOverview(await packsRes.json())
      if (dispatchesRes.ok) setDispatches(await dispatchesRes.json())
    } catch {
      toast.error('Failed to load warehouse data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const generatePacks = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: genProductId, quantity: genQty }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not generate packs')
        return
      }
      toast.success(`${body.created} pack codes generated`)
      const productName = products.find((p) => p.id === genProductId)?.name ?? 'Pack'
      openSheet(
        `${productName} — ${body.created} new packs`,
        body.packs.map((p: { code: string }) => ({ code: p.code, product: productName }))
      )
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setGenerating(false)
    }
  }

  const dispatchPacks = async (e: React.FormEvent) => {
    e.preventDefault()
    setDispatching(true)
    try {
      const res = await fetch('/api/admin/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailer: dispRetailer,
          productId: dispProductId,
          quantity: dispQty,
          note: dispNote || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not dispatch packs')
        return
      }
      toast.success(`${body.packs.length} packs dispatched to ${body.retailer}`)
      const productName = products.find((p) => p.id === dispProductId)?.name ?? 'Pack'
      openSheet(
        `${body.retailer} — ${format(new Date(), 'd MMM yyyy')}`,
        (body.packs as string[]).map((code) => ({ code, product: productName }))
      )
      setDispRetailer('')
      setDispNote('')
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setDispatching(false)
    }
  }

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLookingUp(true)
    setLookupNotFound(false)
    setLookupResult(null)
    try {
      const res = await fetch(`/api/admin/packs?code=${encodeURIComponent(lookupCode.trim())}`)
      if (res.status === 404) {
        setLookupNotFound(true)
        return
      }
      if (res.ok) setLookupResult(await res.json())
    } catch {
      toast.error('Network error')
    } finally {
      setLookingUp(false)
    }
  }

  const printDispatch = async (d: DispatchRow) => {
    try {
      const res = await fetch(`/api/admin/packs?dispatchId=${d.id}`)
      if (!res.ok) {
        toast.error('Could not load pack codes')
        return
      }
      const packs: { code: string; product?: { name: string } }[] = await res.json()
      openSheet(
        `${d.retailer} — ${format(new Date(d.createdAt), 'd MMM yyyy')}`,
        packs.map((p) => ({ code: p.code, product: p.product?.name ?? '' }))
      )
    } catch {
      toast.error('Network error')
    }
  }

  const deleteDispatch = async (id: string) => {
    const res = await fetch(`/api/admin/dispatches/${id}`, { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    if (res.ok) {
      toast.success('Dispatch removed — packs returned to warehouse')
      load()
    } else {
      toast.error(body?.error ?? 'Could not remove dispatch')
    }
    setDeleteDispatchId(null)
  }

  const openSheet = (title: string, codes: QrSheet['codes']) => {
    setSheet({ title, codes })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const statTiles = overview
    ? [
        { label: 'In warehouse', value: overview.stats.in_warehouse, icon: Boxes, cls: 'text-foreground' },
        { label: 'At retailers', value: overview.stats.dispatched, icon: MapPin, cls: 'text-amber-600' },
        { label: 'Sold (scanned)', value: overview.stats.sold, icon: PackageCheck, cls: 'text-emerald-600' },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Warehouse</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track every pack out of the warehouse: generated → dispatched → sold via QR scan.
        </p>
      </div>

      {/* Stock tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statTiles.map((t) => {
          const Icon = t.icon
          return (
            <Card key={t.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className="size-4" /> {t.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${t.cls}`}>{t.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">packs</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="dispatch">
        <TabsList>
          <TabsTrigger value="dispatch">Generate & dispatch</TabsTrigger>
          <TabsTrigger value="dispatches">Dispatches</TabsTrigger>
          <TabsTrigger value="lookup">Pack lookup</TabsTrigger>
          <TabsTrigger value="flags">
            Flags
            {overview && (overview.flags.rescanned.length > 0 || overview.flags.stale.length > 0) && (
              <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {overview.flags.rescanned.length + overview.flags.stale.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Generate & dispatch */}
        <TabsContent value="dispatch" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="size-4 text-emerald-600" /> Generate pack codes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={generatePacks} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gen-product">Product</Label>
                  <Select value={genProductId} onValueChange={setGenProductId}>
                    <SelectTrigger id="gen-product"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gen-qty">How many packs</Label>
                  <Input id="gen-qty" type="number" min={1} max={5000} value={genQty}
                    onChange={(e) => setGenQty(e.target.value)} required />
                </div>
                <Button type="submit" disabled={generating || !genProductId} className="bg-emerald-600 hover:bg-emerald-500">
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                  Generate & open QR sheet
                </Button>
                <p className="text-xs text-muted-foreground">
                  Each pack gets a unique code (e.g. VG-7F3K9Q). Print the sticker sheet and label your packs.
                </p>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="size-4 text-emerald-600" /> Dispatch to retailer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={dispatchPacks} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="disp-retailer">Retailer / store</Label>
                  <Input id="disp-retailer" value={dispRetailer} maxLength={120}
                    onChange={(e) => setDispRetailer(e.target.value)}
                    placeholder="e.g. Green Mart Ambalangoda" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="disp-product">Product</Label>
                    <Select value={dispProductId} onValueChange={setDispProductId}>
                      <SelectTrigger id="disp-product"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="disp-qty">Packs to send</Label>
                    <Input id="disp-qty" type="number" min={1} max={5000} value={dispQty}
                      onChange={(e) => setDispQty(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="disp-note">Note (optional)</Label>
                  <Input id="disp-note" value={dispNote} maxLength={300}
                    onChange={(e) => setDispNote(e.target.value)} placeholder="e.g. invoice #123" />
                </div>
                <Button type="submit" disabled={dispatching || !dispProductId} className="bg-emerald-600 hover:bg-emerald-500">
                  {dispatching ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Dispatch & open QR sheet
                </Button>
                <p className="text-xs text-muted-foreground">
                  Takes the oldest packs still in the warehouse. Buyers scanning those codes mark them sold automatically.
                </p>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dispatches */}
        <TabsContent value="dispatches">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dispatch history & sell-through</CardTitle>
            </CardHeader>
            <CardContent>
              {dispatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dispatches yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Retailer</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead className="text-right">Sold / sent</TableHead>
                      <TableHead className="text-right">Sell-through</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches.map((d) => {
                      const pct = d.totalPacks ? Math.round((d.soldPacks / d.totalPacks) * 100) : 0
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="whitespace-nowrap">{format(new Date(d.createdAt), 'd MMM yyyy')}</TableCell>
                          <TableCell className="font-medium">
                            {d.retailer}
                            {d.note && <div className="text-xs text-muted-foreground">{d.note}</div>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.products.map((p) => `${p.name} ×${p.total}`).join(', ')}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {d.soldPacks} / {d.totalPacks}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={pct >= 70 ? 'text-emerald-600 font-medium' : pct >= 30 ? 'text-amber-600' : 'text-destructive'}>
                              {pct}%
                            </span>
                            <div className="text-xs text-muted-foreground">{d.totalPacks - d.soldPacks} unaccounted</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => printDispatch(d)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Print QR sheet" title="Print QR sheet">
                                <Printer className="size-4" />
                              </button>
                              <button type="button" onClick={() => setDeleteDispatchId(d.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                aria-label="Remove dispatch" title="Remove (returns packs)">
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lookup */}
        <TabsContent value="lookup">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pack lookup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={lookup} className="flex gap-2 max-w-md">
                <Input
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                  placeholder="VG-XXXXXX"
                  className="font-mono"
                  maxLength={9}
                  required
                />
                <Button type="submit" disabled={lookingUp} className="bg-emerald-600 hover:bg-emerald-500">
                  {lookingUp ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  Find
                </Button>
              </form>

              {lookupNotFound && (
                <p className="text-sm text-destructive">No pack with that code.</p>
              )}

              {lookupResult && (
                <div className="rounded-xl border p-4 space-y-4 max-w-2xl">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-mono text-lg font-semibold">{lookupResult.code}</span>
                    {statusBadge(lookupResult.status)}
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-muted-foreground">Product:</span> {lookupResult.product.name}</div>
                    <div>
                      <span className="text-muted-foreground">Donation value:</span> {fmtLkr(lookupResult.donationAmount)}
                      {lookupResult.status === 'sold' ? ' (counted)' : ' (pending sale)'}
                    </div>
                    <div><span className="text-muted-foreground">Created:</span> {format(new Date(lookupResult.createdAt), 'd MMM yyyy, HH:mm')}</div>
                    {lookupResult.dispatchedAt && (
                      <div><span className="text-muted-foreground">Dispatched:</span> {format(new Date(lookupResult.dispatchedAt), 'd MMM yyyy, HH:mm')} — {lookupResult.dispatch?.retailer}</div>
                    )}
                    {lookupResult.soldAt && (
                      <div><span className="text-muted-foreground">Sold (first scan):</span> {format(new Date(lookupResult.soldAt), 'd MMM yyyy, HH:mm')}</div>
                    )}
                    <div><span className="text-muted-foreground">Total scans:</span> {lookupResult.scanCount}</div>
                  </div>
                  {lookupResult.scans.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Recent scans</div>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {lookupResult.scans.map((s) => (
                          <li key={s.id} className="flex justify-between gap-4 border-b border-border/40 pb-1">
                            <span>{format(new Date(s.createdAt), 'd MMM yyyy, HH:mm:ss')}</span>
                            <span className="truncate max-w-60">{s.userAgent ?? 'unknown device'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flags */}
        <TabsContent value="flags" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> Re-scanned packs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!overview || overview.flags.rescanned.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing flagged — no pack has been scanned more than once.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Scans</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.flags.rescanned.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.code}</TableCell>
                        <TableCell>{p.product.name}</TableCell>
                        <TableCell>{statusBadge(p.status)}</TableCell>
                        <TableCell className={`text-right font-medium ${p.scanCount > 2 ? 'text-destructive' : 'text-amber-600'}`}>
                          {p.scanCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="size-4 text-amber-500" /> Long-unsold at retailers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!overview || overview.flags.stale.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing flagged — every dispatched pack is selling or is recent (under {overview?.flags.staleDays ?? 30} days).
                </p>
              ) : (
                <div className="space-y-3">
                  {overview.flags.stale.map((s) => (
                    <div key={s.retailer} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{s.retailer}</div>
                        <div className="text-xs text-muted-foreground">{s.products.join(', ')}</div>
                        <div className="text-xs text-muted-foreground">
                          oldest dispatched {formatDistanceToNow(new Date(s.oldest), { addSuffix: true })}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">
                        {s.count} pack{s.count === 1 ? '' : 's'} unsold
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR sticker sheet dialog */}
      <QrSheetDialog sheet={sheet} onClose={() => setSheet(null)} />

      {/* Confirm dispatch removal */}
      <AlertDialog open={deleteDispatchId !== null} onOpenChange={(o) => !o && setDeleteDispatchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this dispatch?</AlertDialogTitle>
            <AlertDialogDescription>
              All its unsold packs go back to the warehouse stock. Dispatches with sold packs can't be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDispatchId && deleteDispatch(deleteDispatchId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

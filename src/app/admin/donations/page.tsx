'use client'

import { useEffect, useState } from 'react'
import { formatLkr as fmtLkr } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OrdersTab } from '@/components/admin/orders-tab'
import { DirectDonationsTab } from '@/components/admin/direct-donations-tab'
import { PaymentsTab } from '@/components/admin/payments-tab'
import { MessagesTab } from '@/components/admin/messages-tab'
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
import { format } from 'date-fns'
import QRCode from 'qrcode'
import { Download, HandCoins, Loader2, Package, Plus, QrCode, Trash2 } from 'lucide-react'

interface Product {
  id: string
  name: string
  donationPerUnit: number
  active: boolean
  _count?: { sales: number }
}

interface Sale {
  id: string
  quantity: number
  retailer: string
  donationAmount: number
  createdAt: string
  product: { name: string }
}

export default function AdminDonationsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  // The ledger total — the figure the public wall renders, not just the sum of
  // the sales in the table below (which excludes scanned packs and gifts).
  const [wallTotal, setWallTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Record-sale form
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [retailer, setRetailer] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [recording, setRecording] = useState(false)

  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null)

  // QR
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [siteOrigin, setSiteOrigin] = useState('')

  const activeProducts = products.filter((p) => p.active)

  const load = async () => {
    try {
      const [salesRes, productsRes] = await Promise.all([
        fetch('/api/admin/sales'),
        fetch('/api/admin/products'),
      ])
      if (salesRes.ok) {
        const body = await salesRes.json()
        setSales(body.sales)
        setWallTotal(body.publicTotal ?? 0)
      }
      if (productsRes.ok) {
        const list: Product[] = await productsRes.json()
        setProducts(list)
        // Default the sale form to the first active product
        setProductId((prev) => prev || list.find((p) => p.active)?.id || '')
      }
    } catch {
      toast.error('Failed to load donation data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    // QR is rendered client-side from the origin the admin is browsing.
    QRCode.toDataURL(`${window.location.origin}/donations`, {
      width: 512,
      margin: 2,
      color: { dark: '#065f46', light: '#ffffff' },
    })
      .then((url) => {
        setQrDataUrl(url)
        setSiteOrigin(window.location.origin)
      })
      .catch(() => toast.error('Could not generate QR code'))
  }, [])

  const recordSale = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecording(true)
    try {
      const res = await fetch('/api/admin/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity, retailer, customerName, customerPhone }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not record sale')
        return
      }
      toast.success(
        `Sale recorded — ${fmtLkr((body as Sale).donationAmount)} added to the fund` +
          (customerPhone.trim() ? ', thank-you message queued' : '')
      )
      setQuantity('1')
      setRetailer('')
      setCustomerName('')
      setCustomerPhone('')
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setRecording(false)
    }
  }

  const deleteSale = async (id: string) => {
    const res = await fetch(`/api/admin/sales/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Sale removed')
      load()
    } else {
      toast.error('Could not delete sale')
    }
    setDeleteSaleId(null)
  }

  const selectedProduct = products.find((p) => p.id === productId)
  const previewQty = parseInt(quantity, 10) || 0
  const previewDonation = (selectedProduct?.donationPerUnit ?? 0) * previewQty

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Donations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm customer orders, record store sales, and log gifts — every one adds its own
          donation to the live public total. Products and workshop details live in{' '}
          <a href="/admin/catalog" className="text-emerald-700 dark:text-emerald-400 hover:underline">
            Catalog
          </a>
          .
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HandCoins className="size-4 text-emerald-600" /> Total raised
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{fmtLkr(wallTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Shown live on the Donation Wall — sales, packs and gifts combined
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="size-4 text-emerald-600" /> Sales recorded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Latest 200 shown below</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <QrCode className="size-4 text-emerald-600" /> Donation page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href="/donations"
              target="_blank"
              className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              /donations — open Donation Wall
            </a>
            <p className="text-xs text-muted-foreground mt-1">This is where pack QR codes point</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders open first on purpose: a pending order is the only thing on this
          page that is waiting on someone. Sales and gifts are recorded after the
          fact, so they never need chasing. */}
      <Tabs defaultValue="orders">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="sales">Record & view sales</TabsTrigger>
          <TabsTrigger value="direct">Direct gifts</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="qr">QR code</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <OrdersTab onSettled={load} />
        </TabsContent>

        {/* Sales */}
        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record a sale</CardTitle>
            </CardHeader>
            <CardContent>
              {activeProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active products yet — add one under the <strong>Products</strong> tab first.
                </p>
              ) : (
                <form onSubmit={recordSale} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-product">Product</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger id="sale-product" className="w-full">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({fmtLkr(p.donationPerUnit)}/unit)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-qty">Quantity</Label>
                    <Input
                      id="sale-qty"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-retailer">Retailer / store</Label>
                    <Input
                      id="sale-retailer"
                      value={retailer}
                      onChange={(e) => setRetailer(e.target.value)}
                      placeholder="e.g. Green Mart Ambalangoda"
                      maxLength={120}
                      required
                    />
                  </div>
                  {/* Both optional. A counter sale is often anonymous, and a blank
                      mobile simply means no receipt message is queued — nothing
                      here becomes required. */}
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-name">
                      Customer name <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="sale-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Nimal Perera"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-phone">
                      Mobile <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="sale-phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="07X XXX XXXX"
                      maxLength={20}
                    />
                  </div>
                  <Button type="submit" disabled={recording} className="bg-emerald-600 hover:bg-emerald-500">
                    {recording ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Record
                  </Button>
                  <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                    {previewDonation > 0 && (
                      <>
                        This entry adds <strong className="text-emerald-700 dark:text-emerald-400">{fmtLkr(previewDonation)}</strong> to the fund.{' '}
                      </>
                    )}
                    {customerPhone.trim()
                      ? 'A thank-you message will be queued to send.'
                      : 'Add a mobile to queue a thank-you message.'}
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent sales</CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Retailer</TableHead>
                      <TableHead className="text-right">Donation</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(s.createdAt), 'd MMM yyyy, HH:mm')}</TableCell>
                        <TableCell>{s.product.name}</TableCell>
                        <TableCell className="text-right">{s.quantity}</TableCell>
                        <TableCell>{s.retailer}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                          {fmtLkr(s.donationAmount)}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setDeleteSaleId(s.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Delete sale"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Direct gifts — money given with no purchase */}
        <TabsContent value="direct">
          <DirectDonationsTab onSettled={load} />
        </TabsContent>

        {/* Payments — every receipt, whatever it paid for */}
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>

        {/* Messages — the outbox: who we still owe a message to, and who has had
            one. Deliberately a TAB and not a 9th admin nav item: the mobile
            bottom bar is already full at 8 (see admin-layout-client.tsx). */}
        <TabsContent value="messages">
          <MessagesTab />
        </TabsContent>

        {/* QR */}
        <TabsContent value="qr">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pack QR code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                General-purpose QR for posters and promotions — it just opens the Donation Wall.
                For <strong>per-pack tracking codes</strong>, use the <strong>Warehouse</strong> page
                instead. Currently points to:
              </p>
              <code className="block rounded bg-muted px-3 py-2 text-sm break-all">{siteOrigin}/donations</code>
              {qrDataUrl ? (
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <img
                    src={qrDataUrl}
                    alt="QR code linking to the Donation Wall"
                    className="h-48 w-48 rounded-lg border bg-white p-2"
                  />
                  <a
                    href={qrDataUrl}
                    download="vermigrow-donation-qr.png"
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                  >
                    <Download className="size-4" />
                    Download PNG (512px)
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Generating…
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmations */}
      <AlertDialog open={deleteSaleId !== null} onOpenChange={(o) => !o && setDeleteSaleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              The donation amount it added will be removed from the public total.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSaleId && deleteSale(deleteSaleId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

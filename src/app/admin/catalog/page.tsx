'use client'

import { useEffect, useState } from 'react'
import { formatLkr } from '@/lib/currency'
import { FileUpload } from '@/components/admin/file-upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { AlertTriangle, Loader2, Pencil, Plus, Trash2, Wrench, Package } from 'lucide-react'

interface Item {
  id: string
  name: string
  kind: string
  price: number
  unit: string
  description: string
  imageUrl: string | null
  donationPerUnit: number
  eventDate: string | null
  location: string | null
  capacity: number | null
  active: boolean
  seatsTaken: number
  _count?: { sales: number }
}

interface FormState {
  name: string
  kind: 'product' | 'service'
  price: string
  unit: string
  description: string
  imageUrl: string
  donationPerUnit: string
  eventDate: string
  location: string
  capacity: string
  active: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  kind: 'product',
  price: '',
  unit: '',
  description: '',
  imageUrl: '',
  donationPerUnit: '20',
  eventDate: '',
  location: '',
  capacity: '',
  active: true,
}

/** An item is only sellable online once it has a price — see src/lib/catalog.ts. */
function isOrderable(item: Item): boolean {
  return item.price > 0
}

export default function AdminCatalogPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)

  const refresh = () => setReloadKey((k) => k + 1)

  // Inline async effect: setting state after `await` is not a cascading render,
  // whereas calling a component-scope loader would trip react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/products')
        if (!res.ok) throw new Error('failed')
        const body: Item[] = await res.json()
        if (!cancelled) setItems(body)
      } catch {
        if (!cancelled) toast.error('Could not load the catalog')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (item: Item) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      kind: item.kind === 'service' ? 'service' : 'product',
      price: String(item.price),
      unit: item.unit,
      description: item.description,
      imageUrl: item.imageUrl ?? '',
      donationPerUnit: String(item.donationPerUnit),
      // <input type="date"> wants YYYY-MM-DD, not a full ISO timestamp.
      eventDate: item.eventDate ? item.eventDate.slice(0, 10) : '',
      location: item.location ?? '',
      capacity: item.capacity === null ? '' : String(item.capacity),
      active: item.active,
    })
    setFormOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        kind: form.kind,
        price: form.price,
        unit: form.unit,
        description: form.description,
        imageUrl: form.imageUrl,
        donationPerUnit: form.donationPerUnit,
        // Empty strings become NULL server-side (see src/lib/product-schema.ts).
        eventDate: form.eventDate,
        location: form.location,
        capacity: form.capacity,
        active: form.active,
      }
      const res = await fetch(
        editingId ? `/api/admin/products/${editingId}` : '/api/admin/products',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const body = await res.json()
      if (!res.ok) {
        const details = body?.details
        const firstField = details ? Object.values(details)[0] : null
        const detail = Array.isArray(firstField) ? String(firstField[0]) : null
        toast.error(detail ?? body?.error ?? 'Could not save this item')
        return
      }
      toast.success(editingId ? 'Item updated' : 'Item added')
      setFormOpen(false)
      refresh()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: Item) => {
    const res = await fetch(`/api/admin/products/${item.id}`, { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    if (res.ok) {
      toast.success('Item deleted')
      refresh()
    } else {
      toast.error(body?.error ?? 'Could not delete this item')
    }
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  const unpriced = items.filter((i) => i.active && !isOrderable(i))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything the farm sells — products and paid services. Each item sends its own
            donation per unit to the public fund.
          </p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={openCreate}>
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      {unpriced.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {unpriced.length === 1 ? '1 active item has' : `${unpriced.length} active items have`} no
            price yet, so {unpriced.length === 1 ? 'it is' : 'they are'} not orderable online — the
            order page shows &ldquo;Ask for price&rdquo; instead.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing in the catalog yet. Add your first product or workshop.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const oversubscribed =
                  item.kind === 'service' &&
                  item.capacity !== null &&
                  item.seatsTaken > item.capacity
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                      {item.kind === 'service' ? (
                        <Wrench className="size-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Package className="size-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </span>

                    <div className="min-w-[10rem] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {!item.active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            Inactive
                          </span>
                        )}
                        {oversubscribed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            <AlertTriangle className="size-3" /> Over capacity
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.kind === 'service' ? 'Service' : 'Product'}
                        {item.unit ? ` · ${item.unit}` : ''}
                        {item.location ? ` · ${item.location}` : ''}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-medium tabular-nums">
                        {isOrderable(item) ? formatLkr(item.price) : 'No price'}
                      </div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                        +{formatLkr(item.donationPerUnit)} / unit
                      </div>
                    </div>

                    <div className="w-28 text-right text-xs text-muted-foreground">
                      {item.kind === 'service' && item.capacity !== null ? (
                        <>
                          <span className={oversubscribed ? 'text-destructive' : ''}>
                            {item.seatsTaken} / {item.capacity} seats
                          </span>
                          <div>booked</div>
                        </>
                      ) : (
                        <>
                          <span>{item._count?.sales ?? 0}</span>
                          <div>paid sales</div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit item' : 'Add an item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. VermiGrow Fertilizer 1kg"
                  maxLength={120}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-kind">Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as 'product' | 'service' })}
                >
                  <SelectTrigger id="cat-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product — a physical item</SelectItem>
                    <SelectItem value="service">Service — a workshop or training</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-unit">Unit</Label>
                <Input
                  id="cat-unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder={form.kind === 'service' ? 'per seat' : 'per pack'}
                  maxLength={24}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-price">Price (LKR)</Label>
                <Input
                  id="cat-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  A dash means it is not orderable online.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-donation">Donation per unit (LKR)</Label>
                <Input
                  id="cat-donation"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.donationPerUnit}
                  onChange={(e) => setForm({ ...form, donationPerUnit: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Goes to the public fund for every unit or seat sold.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-event">Date (services)</Label>
                <Input
                  id="cat-event"
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for an enroll-anytime program.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-capacity">Seats (services)</Label>
                <Input
                  id="cat-capacity"
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Blank means unlimited. Online orders stop at this number.
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cat-location">Location (services)</Label>
                <Input
                  id="cat-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  maxLength={120}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cat-desc">Description</Label>
                <textarea
                  id="cat-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={2000}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Shown on the order page."
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Image</Label>
                {/* Keyed by item so switching items remounts the preview —
                    FileUpload seeds its preview once from currentUrl. */}
                <FileUpload
                  key={editingId ?? 'new'}
                  currentUrl={form.imageUrl}
                  onUpload={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 sm:col-span-2">
                <div>
                  <Label htmlFor="cat-active" className="text-sm">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive items are hidden from the order page and cannot take new sales.
                  </p>
                </div>
                <Switch
                  id="cat-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Add item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Items with recorded sales cannot be deleted — deactivate them instead so the sales
              history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && remove(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

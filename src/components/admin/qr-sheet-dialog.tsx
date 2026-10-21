'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { FileDown, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  BRAND_BAND_MM,
  CODE_BAND_MM,
  computeSheetLayout,
  DEFAULT_QR_SHEET_OPTIONS,
  GAP_MAX_MM,
  MARGIN_MAX_MM,
  MAX_PDF_CODES,
  PAGE_MAX_MM,
  PAGE_MIN_MM,
  PAPER_PRESETS,
  PREVIEW_LIMIT,
  PRODUCT_BAND_MM,
  QR_MAX_MM,
  QR_MIN_MM,
  STICKER_BRAND,
  STICKER_PADDING_MM,
  stickerPdfFilename,
  sanitizeStickerText,
  type PaperId,
  type QrSheetOptions,
  type SheetOrientation,
} from '@/lib/qr-sheet'

export interface QrSheetCode {
  code: string
  product: string
}

export interface QrSheet {
  title: string
  codes: QrSheetCode[]
}

export function QrSheetDialog({
  sheet,
  onClose,
}: {
  sheet: QrSheet | null
  onClose: () => void
}) {
  const [options, setOptions] = useState<QrSheetOptions>(DEFAULT_QR_SHEET_OPTIONS)
  const [urls, setUrls] = useState<string[]>([])
  const [preparing, setPreparing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const codes = sheet?.codes ?? []
  const layout = useMemo(() => computeSheetLayout(options, codes.length), [options, codes.length])
  const previewCodes = useMemo(() => codes.slice(0, PREVIEW_LIMIT), [codes])
  const capped = codes.length > PREVIEW_LIMIT

  // Render preview QR images. 512 px is plenty on screen; the PDF rasterises
  // each code at print resolution independently.
  useEffect(() => {
    if (!sheet) return
    let cancelled = false
    setPreparing(true)
    setUrls([])

    const origin = window.location.origin
    const list = sheet.codes.slice(0, PREVIEW_LIMIT)
    ;(async () => {
      const out: string[] = new Array(list.length)
      const CHUNK = 8
      for (let i = 0; i < list.length; i += CHUNK) {
        await Promise.all(
          list.slice(i, i + CHUNK).map(async (entry, j) => {
            out[i + j] = await QRCode.toDataURL(`${origin}/donations?c=${entry.code}`, {
              width: 512,
              margin: 2,
              errorCorrectionLevel: 'M',
              color: { dark: '#111827', light: '#ffffff' },
            })
          })
        )
        if (cancelled) return
      }
      if (!cancelled) {
        setUrls(out)
        setPreparing(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sheet])

  // The browser print has to obey the same paper choice as the PDF. A style
  // element appended last in <head> wins over the static print rules.
  useEffect(() => {
    if (!sheet || !layout.ok) return
    const style = document.createElement('style')
    style.id = 'qr-sheet-page-style'
    style.textContent =
      `@page { size: ${layout.pageWidthMm}mm ${layout.pageHeightMm}mm; ` +
      `margin: ${layout.marginMm}mm; }`
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  }, [sheet, layout.ok, layout.pageWidthMm, layout.pageHeightMm, layout.marginMm])

  const update = <K extends keyof QrSheetOptions>(key: K, value: QrSheetOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  const setNumber = (key: keyof QrSheetOptions, raw: string) => {
    const value = raw === '' ? 0 : Number(raw)
    setOptions((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : 0 }))
  }

  const downloadPdf = async () => {
    if (!sheet) return
    setDownloading(true)
    try {
      const res = await fetch('/api/admin/packs/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: sheet.codes.map((c) => c.code), layout: options }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? 'Could not build the PDF')
        return
      }

      const skipped = Number(res.headers.get('x-sheet-skipped') ?? 0)
      const blob = await res.blob()
      const filename =
        /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
        stickerPdfFilename(sheet.codes.length, options)

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      if (skipped > 0) {
        toast.warning(`PDF downloaded — ${skipped} unknown code(s) were skipped.`)
      } else {
        toast.success('PDF downloaded')
      }
    } catch {
      toast.error('Network error while building the PDF')
    } finally {
      setDownloading(false)
    }
  }

  const brandParts = STICKER_BRAND.split(/\s+/)
  const brandFirst = (brandParts[0] ?? '').toUpperCase()
  const brandRest = brandParts.slice(1).join(' ').toUpperCase()

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.max(layout.columns, 1)}, ${layout.cellWidthMm}mm)`,
    gap: `${options.gapMm}mm`,
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto' as const,
    justifyContent: 'safe center' as const,
    '--qr-cell-w': `${layout.cellWidthMm}mm`,
    '--qr-cell-h': `${layout.cellHeightMm}mm`,
    '--qr-gap': `${options.gapMm}mm`,
    '--qr-size': `${options.qrMm}mm`,
    '--qr-pad': `${STICKER_PADDING_MM}mm`,
    '--qr-brand-size': `${layout.fonts.brandPt}pt`,
    '--qr-code-size': `${layout.fonts.codePt}pt`,
    '--qr-product-size': `${layout.fonts.productPt}pt`,
  } as React.CSSProperties

  return (
    <Dialog open={sheet !== null} onOpenChange={(open) => !open && onClose()}>
      {/* sm:max-w-5xl (not max-w-5xl) so tailwind-merge replaces the dialog's
          default sm:max-w-lg instead of losing to it at ≥640px. */}
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>QR sticker sheet</DialogTitle>
          <DialogDescription>
            {sheet?.title} — {codes.length} sticker(s). Choose the paper, then download the PDF or
            print.
          </DialogDescription>
        </DialogHeader>

        {/* Paper + sticker settings */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="qr-paper">Paper</Label>
            <Select value={options.paper} onValueChange={(v) => update('paper', v as PaperId)}>
              <SelectTrigger id="qr-paper">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label} ({p.widthMm}×{p.heightMm})
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-orientation">Orientation</Label>
            <Select
              value={options.orientation}
              onValueChange={(v) => update('orientation', v as SheetOrientation)}
            >
              <SelectTrigger id="qr-orientation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-margin">Margin (mm)</Label>
            <Input
              id="qr-margin"
              type="number"
              min={0}
              max={MARGIN_MAX_MM}
              step={1}
              value={options.marginMm}
              onChange={(e) => setNumber('marginMm', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-size">QR size (mm)</Label>
            <Input
              id="qr-size"
              type="number"
              min={QR_MIN_MM}
              max={QR_MAX_MM}
              step={1}
              value={options.qrMm}
              onChange={(e) => setNumber('qrMm', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-gap">Gap (mm)</Label>
            <Input
              id="qr-gap"
              type="number"
              min={0}
              max={GAP_MAX_MM}
              step={1}
              value={options.gapMm}
              onChange={(e) => setNumber('gapMm', e.target.value)}
            />
          </div>

          {options.paper === 'custom' && (
            <div className="space-y-1.5">
              <Label>Custom (mm)</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  aria-label="Paper width in millimetres"
                  type="number"
                  min={PAGE_MIN_MM}
                  max={PAGE_MAX_MM}
                  step={1}
                  value={options.widthMm}
                  onChange={(e) => setNumber('widthMm', e.target.value)}
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  aria-label="Paper height in millimetres"
                  type="number"
                  min={PAGE_MIN_MM}
                  max={PAGE_MAX_MM}
                  step={1}
                  value={options.heightMm}
                  onChange={(e) => setNumber('heightMm', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {layout.ok ? (
            <>
              <span className="font-medium text-foreground">
                {layout.columns} × {layout.rows} per page
              </span>{' '}
              · {layout.perPage} per page · {layout.pages} page{layout.pages === 1 ? '' : 's'} ·{' '}
              {layout.pageWidthMm}×{layout.pageHeightMm} mm
            </>
          ) : (
            <span className="text-destructive">{layout.errors[0]}</span>
          )}
        </div>

        {layout.errors.length > 1 && (
          <ul className="text-sm text-destructive space-y-0.5">
            {layout.errors.slice(1).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {layout.warnings.length > 0 && (
          <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-0.5">
            {layout.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {preparing ? (
          <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Rendering {previewCodes.length} QR codes…
          </div>
        ) : (
          <div className="print-sheet" style={gridStyle}>
            {previewCodes.map((entry, i) => (
              <div
                key={`${entry.code}-${i}`}
                style={{
                  width: `${layout.cellWidthMm}mm`,
                  height: `${layout.cellHeightMm}mm`,
                  boxSizing: 'border-box',
                  border: '0.4pt solid #d1d5db',
                  background: '#ffffff',
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid',
                }}
              >
                <div
                  className="qr-cell-inner"
                  style={{
                    height: '100%',
                    padding: `${STICKER_PADDING_MM}mm`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      height: `${BRAND_BAND_MM}mm`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1.05,
                      fontSize: `${layout.fonts.brandPt}pt`,
                      fontWeight: 700,
                      color: '#047857',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{brandFirst}</span>
                    <span>{brandRest}</span>
                  </div>

                  {urls[i] ? (
                    <img
                      src={urls[i]}
                      alt={entry.code}
                      style={{
                        width: `${options.qrMm}mm`,
                        height: `${options.qrMm}mm`,
                        display: 'block',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div style={{ width: `${options.qrMm}mm`, height: `${options.qrMm}mm` }} />
                  )}

                  <div
                    style={{
                      height: `${CODE_BAND_MM}mm`,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: `${layout.fonts.codePt}pt`,
                      fontWeight: 700,
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {entry.code}
                  </div>

                  <div
                    style={{
                      height: `${PRODUCT_BAND_MM}mm`,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: `${layout.fonts.productPt}pt`,
                      color: '#4b5563',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                    title={entry.product}
                  >
                    {sanitizeStickerText(entry.product)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={preparing || !layout.ok || capped}
            title={capped ? `Browser print is limited to ${PREVIEW_LIMIT} stickers — use Download PDF` : undefined}
          >
            <Printer className="size-4" /> Print
          </Button>
          <Button
            onClick={downloadPdf}
            disabled={downloading || !layout.ok || codes.length > MAX_PDF_CODES}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

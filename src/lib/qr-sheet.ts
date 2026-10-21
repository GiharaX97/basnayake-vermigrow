/**
 * Geometry for the printable QR sticker sheet.
 *
 * This module is isomorphic on purpose: the admin dialog uses it to lay out the
 * on-screen preview and the browser print, and the server uses the very same
 * numbers to draw the downloadable PDF. If the two ever computed their own
 * columns the preview would stop being a preview.
 *
 * Keep it free of `node:*`, Prisma, `qrcode` and DOM imports.
 */

export const MM_PER_INCH = 25.4
export const PT_PER_MM = 72 / MM_PER_INCH

export type PaperId = 'a4' | 'a5' | 'a6' | 'letter' | 'legal' | 'custom'
export type SheetOrientation = 'portrait' | 'landscape'

export interface PaperPreset {
  id: Exclude<PaperId, 'custom'>
  label: string
  widthMm: number
  heightMm: number
}

/** Portrait dimensions. Landscape is the same sheet with the sides swapped. */
export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'a5', label: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'a6', label: 'A6', widthMm: 105, heightMm: 148 },
  { id: 'letter', label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  { id: 'legal', label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
]

export interface QrSheetOptions {
  paper: PaperId
  /** Portrait dimensions; only read when paper === 'custom'. */
  widthMm: number
  heightMm: number
  orientation: SheetOrientation
  marginMm: number
  qrMm: number
  gapMm: number
}

export const DEFAULT_QR_SHEET_OPTIONS: QrSheetOptions = {
  paper: 'a4',
  widthMm: 210,
  heightMm: 297,
  orientation: 'portrait',
  marginMm: 8,
  qrMm: 42,
  gapMm: 2,
}

/** The site's canonical brand casing (see src/lib/content-defaults.ts). */
export const STICKER_BRAND = 'Basnayaka Vermigrow'

export const PAGE_MIN_MM = 30
export const PAGE_MAX_MM = 1000
export const MARGIN_MAX_MM = 40
export const QR_MIN_MM = 15
export const QR_MAX_MM = 200
export const GAP_MAX_MM = 20

/**
 * The browser can only print what is in the DOM, and every preview QR is a data
 * URL rendered one by one. Beyond this the dialog would freeze; the PDF is not
 * limited in the same way.
 */
export const PREVIEW_LIMIT = 200

/** Matches the generation endpoint's per-batch ceiling. */
export const MAX_PDF_CODES = 5000

/** A guard against a tiny custom page turning 5 000 codes into 5 000 pages. */
export const MAX_PDF_PAGES = 500

// Sticker anatomy, in millimetres. Changing any of these changes the PDF and
// the preview together — that is the point.
export const STICKER_PADDING_MM = 1.5
export const BRAND_BAND_MM = 5.5 // two lines: BASNAYAKA / VERMIGROW
export const CODE_BAND_MM = 4
export const PRODUCT_BAND_MM = 4

export interface SheetFontSizes {
  brandPt: number
  codePt: number
  productPt: number
}

export interface SheetLayout {
  ok: boolean
  errors: string[]
  warnings: string[]
  pageWidthMm: number
  pageHeightMm: number
  marginMm: number
  usableWidthMm: number
  usableHeightMm: number
  cellWidthMm: number
  cellHeightMm: number
  columns: number
  rows: number
  perPage: number
  pages: number
  gridWidthMm: number
  gridHeightMm: number
  /** Left edge of the grid, from the page's left edge. */
  startXMm: number
  /** Top edge of the grid, from the page's top edge. */
  startYMm: number
  fonts: SheetFontSizes
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function resolvePaperMm(
  options: Pick<QrSheetOptions, 'paper' | 'widthMm' | 'heightMm' | 'orientation'>
): { widthMm: number; heightMm: number } {
  const preset = PAPER_PRESETS.find((p) => p.id === options.paper)
  const baseW = preset ? preset.widthMm : options.widthMm
  const baseH = preset ? preset.heightMm : options.heightMm
  return options.orientation === 'landscape'
    ? { widthMm: baseH, heightMm: baseW }
    : { widthMm: baseW, heightMm: baseH }
}

/**
 * Compute the sticker grid for `stickerCount` codes.
 *
 * Every failure is collected rather than thrown so the dialog can explain the
 * problem next to the controls; the API route turns a non-ok layout into a 400.
 */
export function computeSheetLayout(options: QrSheetOptions, stickerCount: number): SheetLayout {
  const errors: string[] = []
  const warnings: string[] = []

  if (!Number.isFinite(stickerCount) || stickerCount < 1) {
    errors.push('No pack codes supplied.')
  }
  if (stickerCount > MAX_PDF_CODES) {
    errors.push(`A sheet can contain at most ${MAX_PDF_CODES.toLocaleString()} stickers.`)
  }

  const { widthMm, heightMm } = resolvePaperMm(options)

  if (!Number.isFinite(widthMm) || widthMm < PAGE_MIN_MM || widthMm > PAGE_MAX_MM) {
    errors.push(`Paper width must be between ${PAGE_MIN_MM} and ${PAGE_MAX_MM} mm.`)
  }
  if (!Number.isFinite(heightMm) || heightMm < PAGE_MIN_MM || heightMm > PAGE_MAX_MM) {
    errors.push(`Paper height must be between ${PAGE_MIN_MM} and ${PAGE_MAX_MM} mm.`)
  }
  if (!Number.isFinite(options.marginMm) || options.marginMm < 0 || options.marginMm > MARGIN_MAX_MM) {
    errors.push(`Margin must be between 0 and ${MARGIN_MAX_MM} mm.`)
  }
  if (!Number.isFinite(options.qrMm) || options.qrMm < QR_MIN_MM || options.qrMm > QR_MAX_MM) {
    errors.push(`QR size must be between ${QR_MIN_MM} and ${QR_MAX_MM} mm.`)
  }
  if (!Number.isFinite(options.gapMm) || options.gapMm < 0 || options.gapMm > GAP_MAX_MM) {
    errors.push(`Gap must be between 0 and ${GAP_MAX_MM} mm.`)
  }

  // Font sizes grow with the sticker but stay inside the 4 mm text bands.
  const fonts: SheetFontSizes = {
    brandPt: clamp(options.qrMm * 0.14, 5, 7.5),
    codePt: clamp(options.qrMm * 0.2, 7, 10),
    productPt: clamp(options.qrMm * 0.13, 5, 7),
  }

  const cellWidthMm = options.qrMm + STICKER_PADDING_MM * 2
  const cellHeightMm =
    options.qrMm + STICKER_PADDING_MM * 2 + BRAND_BAND_MM + CODE_BAND_MM + PRODUCT_BAND_MM

  const usableWidthMm = widthMm - options.marginMm * 2
  const usableHeightMm = heightMm - options.marginMm * 2

  if (usableWidthMm <= 0 || usableHeightMm <= 0) {
    errors.push('The margins leave no usable area on this paper.')
  }

  const columns =
    usableWidthMm > 0 ? Math.floor((usableWidthMm + options.gapMm) / (cellWidthMm + options.gapMm)) : 0
  const rows =
    usableHeightMm > 0 ? Math.floor((usableHeightMm + options.gapMm) / (cellHeightMm + options.gapMm)) : 0

  if (usableWidthMm > 0 && usableHeightMm > 0 && (columns < 1 || rows < 1)) {
    errors.push(
      `A ${cellWidthMm.toFixed(1)} × ${cellHeightMm.toFixed(1)} mm sticker does not fit inside the ` +
        `${usableWidthMm.toFixed(1)} × ${usableHeightMm.toFixed(1)} mm usable area.`
    )
  }

  const perPage = Math.max(columns, 0) * Math.max(rows, 0)
  const pages = perPage > 0 ? Math.ceil(stickerCount / perPage) : 0

  if (pages > MAX_PDF_PAGES) {
    errors.push(
      `This layout needs ${pages} pages; the maximum is ${MAX_PDF_PAGES}. ` +
        'Use larger paper or a larger QR size.'
    )
  }

  if (options.qrMm < 25) {
    warnings.push('QR codes under 25 mm may be hard to scan with some phones.')
  }
  if (stickerCount > PREVIEW_LIMIT) {
    warnings.push(
      `The preview shows the first ${PREVIEW_LIMIT} stickers; the PDF contains all ${stickerCount}.`
    )
  }

  const gridWidthMm = columns > 0 ? columns * cellWidthMm + (columns - 1) * options.gapMm : 0
  const gridHeightMm = rows > 0 ? rows * cellHeightMm + (rows - 1) * options.gapMm : 0

  // Centred horizontally; top-aligned. The PDF and the CSS preview both use
  // these offsets, in their own coordinate systems.
  const startXMm = options.marginMm + Math.max(0, (usableWidthMm - gridWidthMm) / 2)
  const startYMm = options.marginMm

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    pageWidthMm: widthMm,
    pageHeightMm: heightMm,
    marginMm: options.marginMm,
    usableWidthMm,
    usableHeightMm,
    cellWidthMm,
    cellHeightMm,
    columns: Math.max(columns, 0),
    rows: Math.max(rows, 0),
    perPage,
    pages,
    gridWidthMm,
    gridHeightMm,
    startXMm,
    startYMm,
    fonts,
  }
}

/**
 * Make a string safe for pdf-lib's standard (WinAnsi) fonts and for a sticker.
 *
 * Sinhala and other non-Latin text cannot be drawn with the built-in fonts, so
 * unsupported code points are dropped rather than throwing mid-render. Common
 * typographic punctuation is folded to ASCII first so curly quotes and dashes
 * survive instead of vanishing.
 */
export function sanitizeStickerText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** ASCII-only filename, safe inside Content-Disposition. */
export function stickerPdfFilename(
  stickerCount: number,
  options: QrSheetOptions,
  now: Date = new Date()
): string {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const paper =
    options.paper === 'custom'
      ? `${Math.round(options.widthMm)}x${Math.round(options.heightMm)}mm`
      : options.paper
  return `vg-qr-stickers-${stickerCount}-${paper}-${options.orientation}-${date}.pdf`
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { PACK_CODE_REGEX } from '@/lib/pack-codes'
import {
  computeSheetLayout,
  GAP_MAX_MM,
  MARGIN_MAX_MM,
  MAX_PDF_CODES,
  PAGE_MAX_MM,
  PAGE_MIN_MM,
  QR_MAX_MM,
  QR_MIN_MM,
  type QrSheetOptions,
} from '@/lib/qr-sheet'
import { renderQrSheetPdf } from '@/lib/qr-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const layoutSchema = z.object({
  paper: z.enum(['a4', 'a5', 'a6', 'letter', 'legal', 'custom']),
  widthMm: z.coerce.number().finite().min(PAGE_MIN_MM).max(PAGE_MAX_MM),
  heightMm: z.coerce.number().finite().min(PAGE_MIN_MM).max(PAGE_MAX_MM),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  marginMm: z.coerce.number().finite().min(0).max(MARGIN_MAX_MM),
  qrMm: z.coerce.number().finite().min(QR_MIN_MM).max(QR_MAX_MM),
  gapMm: z.coerce.number().finite().min(0).max(GAP_MAX_MM),
})

const bodySchema = z.object({
  codes: z
    .array(
      z
        .string()
        .transform((v) => v.trim().toUpperCase())
        .pipe(z.string().regex(PACK_CODE_REGEX, 'Invalid pack code'))
    )
    .min(1, 'At least one code is required')
    .max(MAX_PDF_CODES, `Max ${MAX_PDF_CODES} codes per PDF`),
  layout: layoutSchema,
})

/**
 * Downloadable sticker sheet. The first binary response in this app — every
 * other route returns JSON — so the error paths still use the JSON envelope the
 * admin UI's fetch handler already understands.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // A generous bound: 5 000 codes are ~60 KB of JSON.
  if (Number(request.headers.get('content-length') ?? 0) > 200_000) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { codes, layout: layoutOptions } = parsed.data
  const options: QrSheetOptions = layoutOptions
  const layout = computeSheetLayout(options, codes.length)
  if (!layout.ok) {
    return NextResponse.json(
      { error: 'Validation failed', details: { layout: layout.errors } },
      { status: 400 }
    )
  }

  // Chunk the lookup: SQLite has a finite bind-parameter limit and 5 000 codes
  // in one IN-list would approach it.
  const nameByCode = new Map<string, string>()
  for (let i = 0; i < codes.length; i += 500) {
    const rows = await prisma.pack.findMany({
      where: { code: { in: codes.slice(i, i + 500) } },
      select: { code: true, product: { select: { name: true } } },
    })
    for (const row of rows) nameByCode.set(row.code, row.product.name)
  }

  if (nameByCode.size === 0) {
    return NextResponse.json({ error: 'No matching pack codes' }, { status: 404 })
  }

  const found = codes.filter((code) => nameByCode.has(code))
  const skipped = codes.length - found.length

  // NEXTAUTH_URL is the public URL (www.basnayakavermigrow.lk in production,
  // localhost in development) and is what a printed code must keep pointing at.
  const origin = (process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/+$/, '')

  try {
    const pdf = await renderQrSheetPdf({
      stickers: found.map((code) => ({ code, productName: nameByCode.get(code)! })),
      options,
      origin,
    })

    return new Response(Buffer.from(pdf.bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdf.filename}"`,
        'Content-Length': String(pdf.bytes.byteLength),
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
        ...(skipped > 0 ? { 'X-Sheet-Skipped': String(skipped) } : {}),
      },
    })
  } catch (error) {
    console.error('[admin/packs/pdf]', error)
    return NextResponse.json({ error: 'Could not generate PDF' }, { status: 500 })
  }
}

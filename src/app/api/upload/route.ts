import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { uploadsDir } from '@/lib/uploads'

/**
 * Uploaded files are served publicly from /uploads, so the bytes on disk must be
 * exactly the media we claim they are. The browser-supplied `file.type` is
 * attacker-controlled, and the filename is too, so neither is trusted: the file
 * signature is sniffed here and the stored name and extension are generated.
 *
 * SVG is deliberately NOT accepted. It is a document that can carry <script>,
 * and it would be served from our own origin, where it can reach the admin
 * session cookie. If a logo is ever needed, upload a PNG.
 */
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

interface FileType {
  mime: string
  ext: string
}

/** Identify a file from its leading bytes. Returns null for anything unsupported. */
function sniff(buffer: Buffer): FileType | null {
  const b = buffer
  if (b.length < 12) return null

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: '.png' }

  // GIF: "GIF87a" / "GIF89a"
  const head6 = b.subarray(0, 6).toString('latin1')
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return { mime: 'image/gif', ext: '.gif' }

  // WEBP: "RIFF" .... "WEBP"
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP')
    return { mime: 'image/webp', ext: '.webp' }

  // AVIF/HEIF: "ftyp" at offset 4 with an avif/avis brand
  const ftyp = b.subarray(4, 8).toString('latin1')
  const brand = b.subarray(8, 12).toString('latin1')
  if (ftyp === 'ftyp' && (brand === 'avif' || brand === 'avis')) return { mime: 'image/avif', ext: '.avif' }

  // MP4 / QuickTime: "ftyp" box, or a leading "moov" for some encoders.
  if (ftyp === 'ftyp' || b.subarray(4, 8).toString('latin1') === 'moov') {
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: '.mov' }
    return { mime: 'video/mp4', ext: '.mp4' }
  }

  // WebM / Matroska: 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return { mime: 'video/webm', ext: '.webm' }

  return null
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const type = sniff(buffer)
  if (!type) {
    return NextResponse.json(
      { error: 'That file does not look like a supported image or video. Use JPG, PNG, GIF, WebP, AVIF, MP4, WebM or MOV.' },
      { status: 400 }
    )
  }

  // Name is generated, not taken from the upload: the client's filename never
  // reaches the filesystem, so `../`, NULs and double extensions are moot.
  const filename = `${Date.now()}-${randomUUID()}${type.ext}`
  const uploadDir = uploadsDir()

  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)

  return NextResponse.json({ url: `/uploads/${filename}`, filename, type: type.mime })
}

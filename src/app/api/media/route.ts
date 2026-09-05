import { NextResponse } from 'next/server'
import { readdir, stat, unlink } from 'fs/promises'
import path from 'path'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  try {
    const files = await readdir(uploadDir)
    const items = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(uploadDir, filename)
        const stats = await stat(filePath)
        const ext = path.extname(filename).toLowerCase()
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'].includes(ext)
        const isVideo = ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)
        return {
          filename,
          url: `/uploads/${filename}`,
          size: stats.size,
          createdAt: stats.birthtime,
          type: isImage ? 'image' : isVideo ? 'video' : 'other',
        }
      })
    )
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json(items)
  } catch {
    return NextResponse.json([])
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { filename } = await request.json()
  if (!filename) {
    return NextResponse.json({ error: 'No filename provided' }, { status: 400 })
  }
  const filePath = path.join(process.cwd(), 'public', 'uploads', path.basename(filename))
  try {
    await unlink(filePath)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

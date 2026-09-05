import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getContent, saveContent } from '@/lib/content-service'
import { defaultContent } from '@/lib/content-defaults'

export async function GET() {
  let data = await getContent()
  // Auto-seed if DB is empty using shared defaults
  if (!data) {
    await saveContent(JSON.stringify(defaultContent))
    data = JSON.stringify(defaultContent)
  }
  return NextResponse.json(JSON.parse(data))
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  // Basic validation: ensure body is an object with required fields
  if (!body || typeof body !== 'object' || !body.brand) {
    return NextResponse.json({ error: 'Invalid content data' }, { status: 400 })
  }
  await saveContent(JSON.stringify(body))
  return NextResponse.json({ success: true })
}

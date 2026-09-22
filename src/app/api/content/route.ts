import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getContent, saveContent } from '@/lib/content-service'
import { defaultContent, deepMergeDefaults } from '@/lib/content-defaults'

export async function GET() {
  let data = await getContent()
  // Auto-seed if DB is empty using shared defaults
  if (!data) {
    await saveContent(JSON.stringify(defaultContent))
    data = JSON.stringify(defaultContent)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    // Corrupt blob — serve defaults rather than crashing the admin editor
    parsed = defaultContent
  }
  // Fill keys missing from older blobs (sections added after the last save)
  return NextResponse.json(deepMergeDefaults(defaultContent, parsed))
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
  // The root layout is cached (revalidate = 300), so without this an edit would
  // sit behind that window. 'layout' invalidates the layout and every page
  // beneath it. In a Route Handler this marks the path rather than rebuilding
  // now, so the new content is served on the next visit.
  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}

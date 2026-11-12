import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import {
  SMS_SETTINGS_KEY,
  SMS_TEMPLATE_LABELS,
  SMS_TEMPLATE_ORDER,
  SMS_TEMPLATE_PLACEHOLDERS,
  SMS_TEMPLATE_WHEN,
  readSmsSettings,
} from '@/lib/sms/templates'
import { z } from 'zod'

/**
 * Admin control over the outbox: which events text the customer, and what they
 * say. Stored in its own SiteContent row so the page editor cannot overwrite it.
 *
 * GET returns the EFFECTIVE settings — a template with no stored entry is
 * listed as enabled with an empty custom body, which means "use the built-in
 * wording". That way the UI never has to know the fallback rule.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await readSmsSettings(prisma)
  return NextResponse.json({
    templates: SMS_TEMPLATE_ORDER.map((key) => ({
      key,
      label: SMS_TEMPLATE_LABELS[key],
      when: SMS_TEMPLATE_WHEN[key],
      enabled: settings[key]?.enabled !== false,
      body: settings[key]?.body ?? '',
    })),
    placeholders: SMS_TEMPLATE_PLACEHOLDERS,
  })
}

const putSchema = z.object({
  templates: z.record(
    z.string(),
    z.object({
      enabled: z.boolean(),
      body: z.string().max(1000, 'Message is too long').default(''),
    })
  ),
})

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Keep only known templates and their two fields, so an old client cannot
  // smuggle arbitrary JSON into the row.
  const clean: Record<string, { enabled: boolean; body: string }> = {}
  for (const key of SMS_TEMPLATE_ORDER) {
    const entry = parsed.data.templates[key]
    if (!entry) continue
    clean[key] = { enabled: entry.enabled, body: entry.body.trim() }
  }

  await prisma.siteContent.upsert({
    where: { key: SMS_SETTINGS_KEY },
    create: { key: SMS_SETTINGS_KEY, value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  })

  return NextResponse.json({ success: true })
}

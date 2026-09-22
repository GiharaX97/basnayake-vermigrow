import { cache } from 'react'
import { prisma } from './prisma'
import { defaultContent, deepMergeDefaults, type SiteContent } from './content-defaults'

const CONTENT_KEY = 'site-content'

export async function getContent(): Promise<string | null> {
  const row = await prisma.siteContent.findUnique({ where: { key: CONTENT_KEY } })
  return row?.value ?? null
}

export async function saveContent(data: string): Promise<void> {
  await prisma.siteContent.upsert({
    where: { key: CONTENT_KEY },
    create: { key: CONTENT_KEY, value: data },
    update: { value: data },
  })
}

export async function seedDefaultContent(defaultData: string): Promise<void> {
  const existing = await getContent()
  if (!existing) {
    await saveContent(defaultData)
  }
}

/**
 * The render-time read path — used by the root layout and the home page so the
 * CMS content is present in the server-rendered HTML instead of arriving after
 * hydration.
 *
 * Mirrors what `GET /api/content` does (parse → `deepMergeDefaults`), so a blob
 * saved before newer sections existed still renders with those sections filled
 * from the defaults. One deliberate difference: this **never writes**. Seeding
 * an empty row stays the API's job — a render must not have side effects.
 *
 * Wrapped in React's `cache()` so the layout and the page share one query per
 * request rather than each issuing their own.
 *
 * Never throws: a corrupt row or an unreachable database falls back to
 * `defaultContent`, because `/admin/login` must not depend on content.
 */
export const readSiteContent = cache(async (): Promise<SiteContent> => {
  try {
    const raw = await getContent()
    if (!raw) return defaultContent
    return deepMergeDefaults(defaultContent, JSON.parse(raw))
  } catch {
    return defaultContent
  }
})

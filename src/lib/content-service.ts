import { prisma } from './prisma'

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

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const mask = (p) => (p ? p.slice(0, -4).replace(/\d/g, 'x') + p.slice(-4) : null)
const t = (d) => (d ? new Date(d).toISOString().slice(11, 19) : '   --   ')

const rows = await db.customerMessage.findMany({
  orderBy: { createdAt: 'asc' },
  select: {
    template: true, status: true, deliveryStatus: true,
    createdAt: true, sentAt: true, providerMessageId: true, error: true, toPhone: true,
  },
})

let prev = null
for (const r of rows) {
  const gap = prev ? +new Date(r.createdAt) - +new Date(prev) : 0
  console.log(
    t(r.createdAt),
    `(+${String(Math.round(gap / 1000)).padStart(5)}s)`,
    String(r.template).padEnd(16),
    String(r.status).padEnd(8),
    String(r.deliveryStatus ?? '-').padEnd(10),
    (r.providerMessageId ?? '-').slice(0, 8).padEnd(9),
    mask(r.toPhone),
    r.error ? `err=${r.error.slice(0, 60)}` : '',
  )
  prev = r.createdAt
}

await db.$disconnect()

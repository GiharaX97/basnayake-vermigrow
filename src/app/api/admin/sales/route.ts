import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordFundEntry, fundTotal } from '@/lib/fund'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { optionalText } from '@/lib/payments'
import { optionalPhone, queueMessage, linkExpiry, autoDeliver } from '@/lib/notify'
import { z } from 'zod'

const saleSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number().int('Must be a whole number').min(1, 'Must be at least 1').max(100000),
  retailer: z.string().transform((v) => v.trim()).pipe(z.string().min(1, 'Retailer is required').max(120)),
  // Both optional. A counter sale is often anonymous, and nothing here becomes
  // required — a blank phone simply means no message is queued (the queue rule
  // lives in src/lib/notify.ts, not at this call site).
  customerName: optionalText(80),
  customerPhone: optionalPhone,
})

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [sales, sum, publicTotal] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { product: { select: { name: true } } },
    }),
    // Gated on status: an order placed online sits at 'pending' until an admin
    // confirms the money, and an unpaid order must not inflate this figure.
    // SALES ONLY, for context on the table below — it is not the wall's number.
    prisma.sale.aggregate({
      where: { status: 'paid' },
      _sum: { donationAmount: true },
      _count: true,
    }),
    // The wall's number, from the ledger. The admin tile is labelled "Shown live
    // on the Donation Wall", so it has to be the same figure the public sees —
    // and the wall also counts scanned packs and gifts with no purchase, neither
    // of which is a Sale row. Reporting the sales-only sum there read LKR 100
    // while the wall read LKR 180, i.e. the label was a lie.
    fundTotal(prisma),
  ])
  return NextResponse.json({
    sales,
    totalDonated: sum._sum.donationAmount ?? 0,
    saleCount: sum._count,
    publicTotal,
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = saleSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { productId, quantity, retailer, customerName, customerPhone } = result.data
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Snapshot the contribution at entry time; later rate edits don't rewrite
  // history. The ledger write rides in the same transaction as the sale, so a
  // sale can never exist without its contribution being counted (and the
  // reverse) — a partial write here would silently lose donation money.
  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        productId,
        quantity,
        retailer,
        customerName,
        customerPhone,
        // Snapshot of the catalog price. This column defaulted to 0 for counter
        // sales before anything rendered a total for one; the receipt at
        // /r/<token> does now, and "Total LKR 0" on a real purchase would be a
        // lie. Same snapshot discipline as donationAmount.
        unitPrice: product.price,
        donationAmount: quantity * product.donationPerUnit,
      },
      include: { product: { select: { name: true } } },
    })
    await recordFundEntry(tx, {
      channel: 'sale',
      refId: created.id,
      amount: created.donationAmount,
    })
    // Same-transaction message queue, same reasoning as the ledger write.
    await queueMessage(tx, {
      refType: 'sale',
      refId: created.id,
      template: 'sale_thanks',
      data: {
        name: customerName,
        total: created.unitPrice * quantity,
        amount: created.donationAmount,
      },
      toName: customerName,
      toPhone: customerPhone,
      expiresAt: linkExpiry(),
    })
    return created
  })

  // Tell the customer what they gave, now that the sale and its ledger row are
  // committed. AFTER the transaction, never inside it: the gateway is a network
  // call, and one that hangs must not hold the sale's write lock, nor one that
  // fails undo a sale that happened. Awaited so the 201 means the message has
  // been dealt with — and so a test can assert on the result without racing it.
  //
  // Does nothing unless a gateway is configured: with none, the message stays
  // queued for the admin to send by hand. See autoDeliver in src/lib/notify.ts.
  await autoDeliver(prisma, 'sale', sale.id)

  return NextResponse.json(sale, { status: 201 })
}

/**
 * Seed a throwaway demo database for the client presentation screenshots.
 *
 * Run with DATABASE_URL pointing at db/deck-demo.db. Never against custom.db:
 * this script deletes rows before seeding.
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

const now = Date.now()
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000)
const hoursAgo = (n) => new Date(now - n * 60 * 60 * 1000)

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
let counter = 1000
function nextCode() {
  // Deterministic-enough unique codes for the demo: VG- + 6 chars.
  let n = counter++
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[n % ALPHABET.length]
    n = Math.floor(n / ALPHABET.length)
  }
  return `VG-${out}`
}

const NAMES = [
  'Nimal Perera',
  'Sanduni Fernando',
  'Kasun Jayawardena',
  'Dilani Silva',
  'Ruwan Bandara',
  'Ishara Wickramasinghe',
  'Tharindu Gunasekara',
  'Amaya Ratnayake',
  'Chamara Dissanayake',
  'Nadeesha Karunaratne',
  'Sahan Weerasinghe',
  'Piumi Herath',
  'Malsha Ekanayake',
  'Nuwan Abeysekara',
  'Hasini Rajapaksa',
  'Dinesh Kodikara',
  'Upeksha Senanayake',
  'Lahiru Mendis',
]

async function clear() {
  // Child rows first. Order does not matter for SQLite FKs here because all
  // these tables are demo-only, but be tidy.
  await prisma.customerMessage.deleteMany()
  await prisma.customerLink.deleteMany()
  await prisma.smsEvent.deleteMany()
  await prisma.orderEvent.deleteMany()
  await prisma.scanEvent.deleteMany()
  await prisma.fundEntry.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.donor.deleteMany()
  await prisma.pack.deleteMany()
  await prisma.dispatch.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.donation.deleteMany()
  await prisma.product.deleteMany()
  await prisma.inquiry.deleteMany()
  await prisma.upload.deleteMany()
  await prisma.siteContent.deleteMany({ where: { key: { startsWith: 'session:' } } })
}

async function main() {
  if (!String(process.env.DATABASE_URL).includes('deck-demo')) {
    throw new Error('Refusing to seed: DATABASE_URL is not the deck demo database')
  }
  await clear()

  const [p1, p5, p10, workshop, kit] = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Vermigrow Organic Fertilizer — 1 kg',
        kind: 'product',
        price: 750,
        unit: 'per pack',
        description:
          'Living vermicompost for home gardens, potting and vegetable beds. Hand-graded at the farm.',
        imageUrl: '/images/farm-about.jpg',
        donationPerUnit: 20,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Vermigrow Organic Fertilizer — 5 kg',
        kind: 'product',
        price: 3200,
        unit: 'per pack',
        description: 'The family-size pack for larger beds and fruit trees.',
        imageUrl: '/images/farm-hero.jpg',
        donationPerUnit: 50,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Vermicompost — 10 kg bag',
        kind: 'product',
        price: 5600,
        unit: 'per bag',
        description: 'A full-season bag for paddy, coconut and home vegetable plots.',
        imageUrl: '/images/farm-about.jpg',
        donationPerUnit: 80,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Vermiculture Workshop — Farm Session',
        kind: 'service',
        price: 1500,
        unit: 'per seat',
        description:
          'A hands-on morning at the Karandeniya farm: bedding, feeding, harvesting and troubleshooting.',
        imageUrl: '/images/training-day.jpg',
        donationPerUnit: 20,
        eventDate: new Date(now + 14 * 24 * 60 * 60 * 1000),
        location: 'Basnayaka Vermigrow Farm, Karandeniya',
        capacity: 30,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Home Composting Starter Kit',
        kind: 'product',
        price: 2400,
        unit: 'per kit',
        description: 'A bin, bedding, a starter colony of worms and the farm’s own guide.',
        imageUrl: '/images/farm-hero.jpg',
        donationPerUnit: 40,
      },
    }),
  ])

  const greenValley = await prisma.dispatch.create({
    data: { retailer: 'Green Valley Garden Centre — Galle', note: 'Weekly route', createdAt: daysAgo(3) },
  })
  const ruhunu = await prisma.dispatch.create({
    data: { retailer: 'Ruhunu Agro Stores — Matara', note: 'Monthly stock', createdAt: daysAgo(42) },
  })
  const farmStore = await prisma.dispatch.create({
    data: { retailer: 'Farm store — Karandeniya', note: 'Own counter stock', createdAt: daysAgo(8) },
  })
  const lankaHub = await prisma.dispatch.create({
    data: { retailer: 'Lanka Garden Hub — Colombo', note: 'Display stock for the new season', createdAt: daysAgo(1) },
  })

  // Track the packs whose donation should appear on the wall.
  const donorPacks = []
  let packSeq = 0
  const makePack = async (data) => {
    packSeq++
    return prisma.pack.create({
      data: { code: nextCode(), ...data },
      include: { product: true },
    })
  }

  // 120 in the warehouse, ready to label
  for (let i = 0; i < 120; i++) {
    await makePack({ productId: p1.id, donationAmount: 20, status: 'in_warehouse', createdAt: daysAgo(20 - (i % 20)) })
  }

  // A small, tidy dispatch — the one photographed for the sticker sheet
  for (let i = 0; i < 12; i++) {
    await makePack({
      productId: p1.id,
      donationAmount: 20,
      status: 'dispatched',
      dispatchId: lankaHub.id,
      dispatchedAt: daysAgo(1),
      createdAt: daysAgo(2),
    })
  }

  // 60 with Green Valley (recent)
  for (let i = 0; i < 60; i++) {
    await makePack({
      productId: p1.id,
      donationAmount: 20,
      status: 'dispatched',
      dispatchId: greenValley.id,
      dispatchedAt: daysAgo(3),
      createdAt: daysAgo(6),
    })
  }

  // 30 stale with Ruhunu (40+ days, unsold) — drives the "unaccounted" flag
  for (let i = 0; i < 30; i++) {
    await makePack({
      productId: p1.id,
      donationAmount: 20,
      status: 'dispatched',
      dispatchId: ruhunu.id,
      dispatchedAt: daysAgo(42),
      createdAt: daysAgo(46),
    })
  }

  // 24 sold out of Ruhunu (older stock that did move)
  for (let i = 0; i < 24; i++) {
    const pack = await makePack({
      productId: p1.id,
      donationAmount: 20,
      status: 'sold',
      dispatchId: ruhunu.id,
      dispatchedAt: daysAgo(42),
      createdAt: daysAgo(46),
      soldAt: daysAgo(38 - (i % 20)),
      scanCount: 1,
    })
    await prisma.scanEvent.create({ data: { packId: pack.id, createdAt: pack.soldAt } })
    await prisma.fundEntry.create({
      data: { channel: 'pack', refId: pack.id, amount: 20, status: 'paid', createdAt: pack.soldAt },
    })
    donorPacks.push(pack)
  }

  // 186 sold at the store / Green Valley
  for (let i = 0; i < 186; i++) {
    const pack = await makePack({
      productId: p1.id,
      donationAmount: 20,
      status: 'sold',
      dispatchId: i % 3 === 0 ? farmStore.id : greenValley.id,
      dispatchedAt: i % 3 === 0 ? daysAgo(8) : daysAgo(3),
      createdAt: daysAgo(12),
      soldAt: daysAgo(11 - (i % 11)),
      scanCount: 1,
    })
    await prisma.scanEvent.create({ data: { packId: pack.id, createdAt: pack.soldAt } })
    await prisma.fundEntry.create({
      data: { channel: 'pack', refId: pack.id, amount: 20, status: 'paid', createdAt: pack.soldAt },
    })
    donorPacks.push(pack)
  }

  // One re-used code: scanned four times. Kept as an anomaly, never re-counted.
  const repeatPack = await makePack({
    productId: p1.id,
    donationAmount: 20,
    status: 'sold',
    dispatchId: greenValley.id,
    dispatchedAt: daysAgo(3),
    createdAt: daysAgo(12),
    soldAt: daysAgo(9),
    scanCount: 4,
  })
  for (let i = 0; i < 4; i++) {
    await prisma.scanEvent.create({ data: { packId: repeatPack.id, createdAt: daysAgo(9 - i) } })
  }
  await prisma.fundEntry.create({
    data: { channel: 'pack', refId: repeatPack.id, amount: 20, status: 'paid', createdAt: daysAgo(9) },
  })

  // 80 five-kilo packs and 25 ten-kilo bags sold
  for (let i = 0; i < 80; i++) {
    const pack = await makePack({
      productId: p5.id,
      donationAmount: 50,
      status: 'sold',
      dispatchId: greenValley.id,
      dispatchedAt: daysAgo(3),
      createdAt: daysAgo(12),
      soldAt: daysAgo(10 - (i % 10)),
      scanCount: 1,
    })
    await prisma.scanEvent.create({ data: { packId: pack.id, createdAt: pack.soldAt } })
    await prisma.fundEntry.create({
      data: { channel: 'pack', refId: pack.id, amount: 50, status: 'paid', createdAt: pack.soldAt },
    })
    donorPacks.push(pack)
  }
  for (let i = 0; i < 25; i++) {
    const pack = await makePack({
      productId: p10.id,
      donationAmount: 80,
      status: 'sold',
      dispatchId: ruhunu.id,
      dispatchedAt: daysAgo(42),
      createdAt: daysAgo(46),
      soldAt: daysAgo(30 - (i % 10)),
      scanCount: 1,
    })
    await prisma.scanEvent.create({ data: { packId: pack.id, createdAt: pack.soldAt } })
    await prisma.fundEntry.create({
      data: { channel: 'pack', refId: pack.id, amount: 80, status: 'paid', createdAt: pack.soldAt },
    })
    donorPacks.push(pack)
  }

  // The donor wall: a name claims a sold pack, server-side amount.
  for (let i = 0; i < NAMES.length; i++) {
    const pack = donorPacks[i * 7]
    await prisma.donor.create({
      data: {
        name: NAMES[i],
        amount: pack.donationAmount,
        packId: pack.id,
        createdAt: hoursAgo(i * 5 + 2),
      },
    })
  }

  // ---- A paid online order, the receipt we photograph -------------------
  const orderRef = 'VG-2026-1042'
  const orderAt = daysAgo(4)
  const paidAt = daysAgo(2)
  const line1 = await prisma.sale.create({
    data: {
      productId: p1.id,
      quantity: 2,
      retailer: 'Online store',
      donationAmount: 40,
      unitPrice: 750,
      status: 'paid',
      source: 'online',
      customerName: 'Nadeesha Karunaratne',
      customerPhone: '077 123 4567',
      customerEmail: 'nadeesha@example.lk',
      paymentMethod: 'bank_transfer',
      paidAt,
      orderRef,
      fulfillment: 'delivered',
      fulfillmentAt: hoursAgo(20),
      createdAt: orderAt,
      note: 'Please leave with the office if I am not home.',
    },
  })
  const line2 = await prisma.sale.create({
    data: {
      productId: p10.id,
      quantity: 1,
      retailer: 'Online store',
      donationAmount: 80,
      unitPrice: 5600,
      status: 'paid',
      source: 'online',
      customerName: 'Nadeesha Karunaratne',
      customerPhone: '077 123 4567',
      customerEmail: 'nadeesha@example.lk',
      paymentMethod: 'bank_transfer',
      paidAt,
      orderRef,
      fulfillment: 'delivered',
      fulfillmentAt: hoursAgo(20),
      createdAt: orderAt,
    },
  })
  await prisma.payment.create({
    data: {
      amount: 7100,
      method: 'bank_transfer',
      reference: 'BOC-8842190',
      receivedBy: 'Farm office',
      receivedAt: paidAt,
      orderRef,
      saleId: null,
    },
  })
  await prisma.fundEntry.create({
    data: { channel: 'sale', refId: line1.id, amount: 40, status: 'paid', createdAt: paidAt },
  })
  await prisma.fundEntry.create({
    data: { channel: 'sale', refId: line2.id, amount: 80, status: 'paid', createdAt: paidAt },
  })
  await prisma.orderEvent.createMany({
    data: [
      { orderRef, type: 'settled', note: 'Bank transfer confirmed — BOC-8842190', actor: 'admin', createdAt: paidAt },
      { orderRef, type: 'delivered', toStage: 'delivered', actor: 'admin', createdAt: hoursAgo(20) },
    ],
  })
  const receiptToken = randomBytes(18).toString('base64url')
  await prisma.customerLink.create({
    data: { token: receiptToken, refType: 'order', refId: orderRef, createdAt: orderAt },
  })
  await prisma.customerMessage.create({
    data: {
      linkId: (await prisma.customerLink.findUnique({ where: { token: receiptToken } })).id,
      toName: 'Nadeesha Karunaratne',
      toPhone: '0771234567',
      template: 'order_paid',
      body: `Thank you Nadeesha — we received your payment of LKR 7,100.00. LKR 120.00 of it went to Apeksha Hospital. Your receipt: http://localhost:3001/r/${receiptToken}`,
      status: 'sent',
      sentAt: paidAt,
      sentBy: 'auto',
    },
  })

  // ---- A pending online order -----------------------------------------
  await prisma.sale.create({
    data: {
      productId: p5.id,
      quantity: 1,
      retailer: 'Online store',
      donationAmount: 50,
      unitPrice: 3200,
      status: 'pending',
      source: 'online',
      customerName: 'Kasun Jayawardena',
      customerPhone: '071 998 2210',
      customerEmail: 'kasun.j@example.lk',
      orderRef: 'VG-2026-1043',
      createdAt: hoursAgo(6),
    },
  })

  // ---- A paid workshop booking with two vouchers -----------------------
  const workshopRef = 'VG-2026-1041'
  const workshopSale = await prisma.sale.create({
    data: {
      productId: workshop.id,
      quantity: 2,
      retailer: 'Online store',
      donationAmount: 40,
      unitPrice: 1500,
      status: 'paid',
      source: 'online',
      customerName: 'Sanduni Fernando',
      customerPhone: '076 441 8890',
      customerEmail: 'sanduni@example.lk',
      paymentMethod: 'cash',
      paidAt: daysAgo(1),
      orderRef: workshopRef,
      fulfillment: 'confirmed',
      fulfillmentAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
  })
  await prisma.payment.create({
    data: {
      amount: 3000,
      method: 'cash',
      receivedBy: 'Kamal (farm office)',
      receivedAt: daysAgo(1),
      orderRef: workshopRef,
      saleId: workshopSale.id,
    },
  })
  await prisma.fundEntry.create({
    data: { channel: 'sale', refId: workshopSale.id, amount: 40, status: 'paid', createdAt: daysAgo(1) },
  })
  const voucher1 = await makePack({
    productId: workshop.id,
    donationAmount: 0,
    status: 'issued',
    holderName: 'Sanduni Fernando',
    holderPhone: '076 441 8890',
    saleId: workshopSale.id,
    orderRef: workshopRef,
    createdAt: daysAgo(1),
  })
  const voucher2 = await makePack({
    productId: workshop.id,
    donationAmount: 0,
    status: 'redeemed',
    holderName: 'Nimal Perera',
    holderPhone: '077 555 1212',
    saleId: workshopSale.id,
    orderRef: workshopRef,
    redeemedAt: daysAgo(1),
    deliveredAt: daysAgo(1),
    scanCount: 1,
    createdAt: daysAgo(1),
  })
  await prisma.scanEvent.create({ data: { packId: voucher2.id, createdAt: daysAgo(1) } })
  await prisma.orderEvent.createMany({
    data: [
      { orderRef: workshopRef, type: 'settled', note: 'Paid in cash at the farm office', actor: 'admin', createdAt: daysAgo(1) },
      { orderRef: workshopRef, type: 'confirmed', toStage: 'confirmed', actor: 'admin', createdAt: daysAgo(1) },
    ],
  })

  // ---- A counter sale recorded by staff (the 90% who do not scan) ------
  const counterSale = await prisma.sale.create({
    data: {
      productId: p1.id,
      quantity: 10,
      retailer: 'Farm store — Karandeniya',
      donationAmount: 200,
      unitPrice: 750,
      status: 'paid',
      source: 'admin',
      customerName: 'Ruwan Bandara',
      customerPhone: '070 332 7761',
      paymentMethod: 'cash',
      paidAt: daysAgo(1),
      note: 'Walk-in — sold without a scan; receipt sent by SMS.',
      createdAt: daysAgo(1),
    },
  })
  await prisma.payment.create({
    data: {
      amount: 7500,
      method: 'cash',
      receivedBy: 'Kamal (farm office)',
      receivedAt: daysAgo(1),
      saleId: counterSale.id,
    },
  })
  await prisma.fundEntry.create({
    data: { channel: 'sale', refId: counterSale.id, amount: 200, status: 'paid', createdAt: daysAgo(1) },
  })

  // ---- A gift with no purchase ----------------------------------------
  const gift = await prisma.donation.create({
    data: {
      amount: 150000,
      method: 'bank_transfer',
      donorName: 'The Jayasuriya Family',
      donorPhone: '077 100 2000',
      note: 'Annual contribution to the Apeksha Hospital fund',
      status: 'paid',
      createdAt: daysAgo(6),
    },
  })
  await prisma.payment.create({
    data: {
      amount: 150000,
      method: 'bank_transfer',
      reference: 'COM-778120',
      receivedBy: 'Farm office',
      receivedAt: daysAgo(6),
      donationId: gift.id,
    },
  })
  await prisma.fundEntry.create({
    data: { channel: 'direct', refId: gift.id, amount: 150000, status: 'paid', createdAt: daysAgo(6) },
  })

  await prisma.inquiry.createMany({
    data: [
      { name: 'Thilini Perera', email: 'thilini@example.lk', message: 'Do you deliver the 10 kg bags to Kandy?', status: 'unread', createdAt: hoursAgo(5) },
      { name: 'Sunil de Silva', email: 'sunil@example.lk', message: 'Can I book six seats for our school group?', status: 'read', createdAt: daysAgo(2), readAt: daysAgo(1) },
    ],
  })

  const totals = await prisma.fundEntry.aggregate({ where: { status: 'paid' }, _sum: { amount: true } })
  console.log('seeded')
  console.log('order receipt token:', receiptToken)
  console.log('fund total:', totals._sum.amount)
  console.log('products:', { p1: p1.id, p5: p5.id, p10: p10.id, workshop: workshop.id, kit: kit.id })
  console.log('packs:', packSeq)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

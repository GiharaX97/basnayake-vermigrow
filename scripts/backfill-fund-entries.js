/**
 * One-off backfill: seed the donation ledger (`FundEntry`) from contributions
 * that were recorded before the ledger existed.
 *
 * Before the ledger the public total was computed by summing two source tables,
 * each with its own filter:
 *   - `Sale`  rows              -> channel 'sale'
 *   - `Pack`  rows, status sold -> channel 'pack'
 * That per-channel maths is exactly what the ledger replaces, so this script
 * replays both into `FundEntry` once and the read path can then be switched.
 *
 * Safe to re-run: `FundEntry` has @@unique([channel, refId]) and this uses
 * upsert, so a second run is a no-op rather than a double count. It only ever
 * adds missing entries — it never rewrites or removes an existing one.
 *
 * Run with:  node scripts/backfill-fund-entries.js
 */

/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS
   script, run directly by `node` rather than bundled by Next, so `require` is
   the correct import form here (the project has no "type": "module"). */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/** Sum the old way, so we can prove the ledger agrees before trusting it. */
async function legacyTotal() {
  const [sales, packs] = await Promise.all([
    prisma.sale.aggregate({ where: { status: 'paid' }, _sum: { donationAmount: true } }),
    prisma.pack.aggregate({ where: { status: 'sold' }, _sum: { donationAmount: true } }),
  ])
  return (sales._sum.donationAmount ?? 0) + (packs._sum.donationAmount ?? 0)
}

/** Sum the new way: one query over the ledger. */
async function ledgerTotal() {
  const sum = await prisma.fundEntry.aggregate({
    where: { status: 'paid' },
    _sum: { amount: true },
  })
  return sum._sum.amount ?? 0
}

async function seed(channel, rows) {
  let created = 0
  let skipped = 0
  for (const row of rows) {
    const amount = row.donationAmount ?? 0
    // Mirrors recordFundEntry in src/lib/fund.ts: a non-positive contribution
    // would be a LKR 0 row with no effect on the total, so don't write one.
    if (!(amount > 0)) {
      skipped += 1
      continue
    }
    const before = await prisma.fundEntry.findUnique({
      where: { channel_refId: { channel, refId: row.id } },
      select: { id: true },
    })
    if (before) {
      skipped += 1
      continue
    }
    await prisma.fundEntry.create({
      data: { channel, refId: row.id, amount, status: 'paid' },
    })
    created += 1
  }
  console.log(`  ${channel.padEnd(6)} ${String(created).padStart(3)} created, ${skipped} already present / zero`)
  return created
}

async function main() {
  const before = await legacyTotal()
  console.log(`Legacy total (Sale status=paid + Pack status=sold): ${before}`)
  console.log('Seeding ledger...')

  const sales = await prisma.sale.findMany({
    where: { status: 'paid' },
    select: { id: true, donationAmount: true },
  })
  const packs = await prisma.pack.findMany({
    where: { status: 'sold' },
    select: { id: true, donationAmount: true },
  })

  await seed('sale', sales)
  await seed('pack', packs)

  const after = await ledgerTotal()
  console.log(`Ledger total: ${after}`)

  // The whole point of the backfill is that switching the read path must not
  // move the public number. If it did, something is wrong and the read path
  // must NOT be switched.
  if (after !== before) {
    console.error(`\nMISMATCH: ledger ${after} != legacy ${before}. Do not switch the read path.`)
    process.exitCode = 1
  } else {
    console.log('\nLedger agrees with the legacy total. Safe to switch the read path.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

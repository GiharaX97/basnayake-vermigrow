import type { Prisma } from '@prisma/client'

/**
 * The donation fund is a single append-only ledger (`FundEntry`). Every writer
 * goes through this file, so the "count it exactly once" rule lives in one place
 * instead of being re-derived by each caller.
 *
 * Why a ledger and not a sum over the source tables: the fund now has several
 * channels (scanned packs, recorded sales, gifts with no purchase) and will gain
 * more (reverse vending machines). Summing per-channel means every new channel
 * edits the public endpoint, the donations page and the admin tiles. With a
 * ledger the public total is one query and a new channel is one new writer.
 *
 * IDEMPOTENCY IS THE DATABASE'S JOB. `FundEntry` carries
 * `@@unique([channel, refId])`, so a retried scan, a double-clicked "mark paid"
 * or a replayed device event hits the unique index and the second write is a
 * no-op rather than a second contribution. Callers do NOT need to ask "have I
 * already recorded this?" — they call `recordFundEntry` and move on. That is why
 * this returns void and swallows the duplicate case.
 */

/** Where a contribution came from. Mirrors `FundEntry.channel`. */
export type FundChannel = 'sale' | 'pack' | 'direct' | 'machine'

/**
 * The subset of the Prisma client this module needs. Both `PrismaClient` and a
 * `$transaction` callback parameter satisfy it, so callers can pass either and
 * still get their ledger write inside their own transaction.
 */
type FundClient = Prisma.TransactionClient

export interface FundEntryInput {
  channel: FundChannel
  /**
   * Id of the row that produced this contribution (a Sale, Pack or Donation id).
   * Null is reserved for a channel with no natural source row.
   */
  refId: string | null
  /** LKR. Snapshotted by the caller from the source row, never client input. */
  amount: number
}

/**
 * Record a contribution exactly once.
 *
 * First write wins: a repeat call never rewrites the amount. That is deliberate
 * — the amount is always copied from a source row that is itself an immutable
 * snapshot, so a second write carries either the same figure (harmless) or a
 * buggy one (which must not silently restate history). To correct a contribution
 * you change the source row and cancel/re-record the entry explicitly.
 *
 * A non-positive amount writes nothing: `donationPerUnit` may legitimately be 0,
 * and a LKR 0 row is noise in the ledger with no effect on the total.
 */
export async function recordFundEntry(
  client: FundClient,
  { channel, refId, amount }: FundEntryInput
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return

  // A null refId cannot be used as an upsert target: the generated WHERE becomes
  // `refId = NULL`, which matches nothing, so every call would insert a fresh
  // row. Such entries are genuinely distinct events, so a plain insert is right.
  if (refId === null) {
    await client.fundEntry.create({ data: { channel, refId, amount, status: 'paid' } })
    return
  }

  await client.fundEntry.upsert({
    where: { channel_refId: { channel, refId } },
    create: { channel, refId, amount, status: 'paid' },
    update: {}, // already recorded — leave the original amount alone
  })
}

/**
 * The public donation total: every paid entry, one query, regardless of channel.
 * This is the only place the wall's number comes from.
 */
export async function fundTotal(client: FundClient): Promise<number> {
  const sum = await client.fundEntry.aggregate({
    where: { status: 'paid' },
    _sum: { amount: true },
  })
  return sum._sum.amount ?? 0
}

/**
 * Take a contribution back out of the public total without destroying history.
 *
 * A cancelled order or a deleted sale must reduce the wall's number — pretending
 * the money is still there would be dishonest — but deleting the ledger row
 * would erase the fact that it was ever counted. Status does the first job, the
 * retained row does the second.
 */
export async function cancelFundEntry(
  client: FundClient,
  channel: FundChannel,
  refId: string
): Promise<void> {
  await client.fundEntry.updateMany({
    where: { channel, refId, status: 'paid' },
    data: { status: 'cancelled' },
  })
}

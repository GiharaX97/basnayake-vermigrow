import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cancelFundEntry } from '@/lib/fund'
import { isAdminAuthenticated } from '@/lib/admin-auth'

/**
 * Reverse a recorded gift.
 *
 * The row is marked 'cancelled', never deleted: the same rule as deleting a
 * single sale. The public total must drop, because the money is no longer
 * expected — but the record that it was once counted has to survive, or the
 * fund's history stops being auditable.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  try {
    await prisma.$transaction(async (tx) => {
      await tx.donation.update({ where: { id }, data: { status: 'cancelled' } })
      await cancelFundEntry(tx, 'direct', id)
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
  }
}

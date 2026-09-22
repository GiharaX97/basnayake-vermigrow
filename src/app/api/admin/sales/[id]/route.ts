import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cancelFundEntry } from '@/lib/fund'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    await prisma.$transaction(async (tx) => {
      await tx.sale.delete({ where: { id } })
      // The ledger row is KEPT but marked cancelled. Two reasons, and both
      // matter: the public total must drop, because the donation is no longer
      // expected — but the record that it was once counted has to survive, or
      // the fund's history becomes unauditable. Deleting the row would do the
      // first job and fail the second; leaving it 'paid' would fail the first.
      //
      // `FundEntry.refId` is a loose reference with no FK (see schema), so it is
      // expected to point at a row that no longer exists.
      await cancelFundEntry(tx, 'sale', id)
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  }
}

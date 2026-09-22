import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const sold = await prisma.pack.count({ where: { dispatchId: id, status: 'sold' } })
  if (sold > 0) {
    return NextResponse.json(
      { error: `${sold} pack(s) from this dispatch are already sold — the record can't be removed.` },
      { status: 409 }
    )
  }

  // Return every pack to the warehouse, then drop the dispatch record.
  await prisma.pack.updateMany({
    where: { dispatchId: id },
    data: { status: 'in_warehouse', dispatchedAt: null, dispatchId: null },
  })
  try {
    await prisma.dispatch.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 })
  }
}

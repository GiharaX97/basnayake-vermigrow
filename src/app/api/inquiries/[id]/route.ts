import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json()
  const inquiry = await prisma.inquiry.update({
    where: { id },
    data: { status: body.status, readAt: body.status === 'read' ? new Date() : null },
  })
  return NextResponse.json(inquiry)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  await prisma.inquiry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

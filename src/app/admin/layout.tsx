import type { Metadata } from 'next'
import AdminLayoutClient from './admin-layout-client'

export const metadata: Metadata = {
  title: 'Admin Panel — Basnayaka VermiGrow CMS',
  description: 'Content management system for Basnayaka VermiGrow organic farm website',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}

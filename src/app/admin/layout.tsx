import type { Metadata } from 'next'
import AdminLayoutClient from './admin-layout-client'

export const metadata: Metadata = {
  title: 'Admin Panel — Basnayaka Vermigrow CMS',
  description: 'Content management system for Basnayaka Vermigrow organic farm website',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}

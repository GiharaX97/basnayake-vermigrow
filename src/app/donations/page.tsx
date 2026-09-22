import type { Metadata } from 'next'
import { DonationsClient } from '@/components/site/donations-client'

export const metadata: Metadata = {
  title: 'Donation Wall — Basnayaka VermiGrow',
  description:
    'Every pack of Basnayaka VermiGrow sold contributes LKR 20 to our community fund. Scan your pack, add your name, and watch the giving grow live.',
  alternates: { canonical: '/donations' },
}

export default function DonationsPage() {
  return <DonationsClient />
}

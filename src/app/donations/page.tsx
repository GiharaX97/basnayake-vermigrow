import type { Metadata } from 'next'
import { DonationsClient } from '@/components/site/donations-client'

export const metadata: Metadata = {
  title: 'Donation Wall — Basnayaka Vermigrow',
  description:
    'Every pack of Basnayaka Vermigrow sold contributes to Apeksha Hospital. Scan your pack, add your name, and watch the giving grow live.',
  alternates: { canonical: '/donations' },
}

export default function DonationsPage() {
  return <DonationsClient />
}

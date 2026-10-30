import { OrderCompleteClient } from '@/components/site/order-complete-client'

/**
 * Return URL from the hosted card page. It only READS order state; the signed
 * webhook is the only thing that can mark an order paid.
 */
export default async function OrderCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  return <OrderCompleteClient orderRef={ref ?? ''} />
}

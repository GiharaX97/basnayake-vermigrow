import { DemoPayClient } from '@/components/site/demo-pay-client'

/**
 * Stand-in for the hosted card page in demo mode. Server wrapper only because
 * `searchParams` is a Promise in this Next version; the page itself is a client
 * component so it can post the demo event and navigate on.
 */
export default async function DemoPayPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  return <DemoPayClient orderRef={ref ?? ''} />
}

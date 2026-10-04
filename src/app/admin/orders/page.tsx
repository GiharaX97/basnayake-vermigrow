import { OrderList } from '@/components/admin/orders/order-list'

/**
 * Admin → Orders.
 *
 * Server component wrapping the client list so the route itself does no work: the
 * list fetches from `/api/admin/orders`, which is where the admin check lives.
 */
export default function AdminOrdersPage() {
  return <OrderList />
}

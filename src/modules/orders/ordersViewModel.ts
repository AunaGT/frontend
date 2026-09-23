import type { OrderStatus } from '@/services/orderService'

export type PreparationState = 'pending' | 'preparing' | 'ready' | 'delayed' | 'cancelled'
export type DeliveryState = 'pending' | 'transit' | 'delivered' | 'cancelled'

export const orderVisualState = (status: OrderStatus): { preparation: PreparationState; delivery: DeliveryState } => {
  switch (status) {
    case 'DRAFT': return { preparation: 'pending', delivery: 'pending' }
    case 'CONFIRMED': return { preparation: 'preparing', delivery: 'pending' }
    case 'PARTIALLY_FULFILLED': return { preparation: 'ready', delivery: 'transit' }
    case 'FULFILLED': return { preparation: 'ready', delivery: 'delivered' }
    case 'EXPIRED': return { preparation: 'delayed', delivery: 'pending' }
    case 'CANCELLED': return { preparation: 'cancelled', delivery: 'cancelled' }
  }
}

export const orderProgressStep = (status: OrderStatus) => {
  if (status === 'FULFILLED') return 5
  if (status === 'PARTIALLY_FULFILLED') return 4
  if (status === 'CONFIRMED') return 3
  return status === 'DRAFT' ? 1 : 0
}

export const orderPaginationItems = (current: number, total: number): Array<number | 'ellipsis'> => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis', total]
  if (current >= total - 3) return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'ellipsis', current - 2, current - 1, current, current + 1, current + 2, 'ellipsis', total]
}

export const buildOrderMailto = (publicUrl: string, reference?: string | null, customerEmail?: string | null) => {
  const to = customerEmail?.trim() ? encodeURIComponent(customerEmail.trim()) : ''
  const subject = encodeURIComponent(`Pedido ${reference ?? ''}`.trim())
  const body = encodeURIComponent(`Hola,\n\nPuede consultar su pedido en:\n${publicUrl}\n\nSaludos.`)
  return `mailto:${to}?subject=${subject}&body=${body}`
}

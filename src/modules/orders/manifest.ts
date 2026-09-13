import { lazy } from 'react'

export const ordersModule = {
  code: 'orders',
  dependencies: ['inventory', 'contacts'] as const,
  paths: { list: '/pedidos', detail: '/pedidos/:id' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('@/components/orders/OrdersManagement')),
    Detail: lazy(() => import('@/components/orders/OrderDetailPage')),
  },
} as const

import { lazy } from 'react'

export const ordersModule = {
  code: 'orders',
  dependencies: ['inventory', 'contacts'] as const,
  paths: { list: '/pedidos', detail: '/pedidos/:id' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./pages/OrdersManagement')),
    Detail: lazy(() => import('./pages/OrderDetailPage')),
  },
} as const

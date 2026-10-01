import { lazy } from 'react'

export const ordersModule = {
  code: 'orders',
  dependencies: ['inventory', 'contacts'] as const,
  paths: { list: '/pedidos', create: '/pedidos/nuevo', detail: '/pedidos/:id', public: '/p/:token' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./pages/OrdersManagement')),
    Create: lazy(() => import('./pages/NewOrderPage')),
    Detail: lazy(() => import('./pages/OrderDetailPage')),
    Public: lazy(() => import('./pages/PublicOrderPage')),
  },
} as const

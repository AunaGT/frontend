import { lazy } from 'react'

export const returnsModule = {
  code: 'returns',
  dependencies: ['sales', 'inventory'] as const,
  paths: { list: '/devoluciones', detail: '/devoluciones/:id', create: '/returns/new' },
  routePrefixes: ['/returns', '/devoluciones'] as const,
  pages: {
    Management: lazy(() => import('./pages/ReturnsManagement')),
    Detail: lazy(() => import('./pages/ReturnDetailPage')),
    Create: lazy(() => import('./pages/NewReturn')),
  },
} as const

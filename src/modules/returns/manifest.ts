import { lazy } from 'react'

export const returnsModule = {
  code: 'returns',
  dependencies: ['sales', 'inventory'] as const,
  paths: { list: '/devoluciones', create: '/returns/new' },
  routePrefixes: ['/returns'] as const,
  pages: {
    Management: lazy(() => import('./pages/ReturnsManagement')),
    Create: lazy(() => import('./pages/NewReturn')),
  },
} as const

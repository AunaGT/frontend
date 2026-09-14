import { lazy } from 'react'

export const cashClosureModule = {
  code: 'cash-closure',
  dependencies: ['sales'] as const,
  paths: {
    list: '/cierre-caja',
    create: '/cierre-caja/nuevo',
    detail: '/cierre-caja/:id',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./CashClosureManagement')),
    Create: lazy(() => import('./CashClosureCreatePage')),
    Detail: lazy(() => import('./ClosureDetailPage')
      .then((module) => ({ default: module.ClosureDetailPage }))),
  },
} as const

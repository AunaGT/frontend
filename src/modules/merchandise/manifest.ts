import { lazy } from 'react'

export const merchandiseModule = {
  code: 'merchandise',
  dependencies: ['inventory', 'contacts'] as const,
  paths: {
    list: '/mercancia',
    create: '/inventario/registrar-ingreso',
    detail: '/mercancia/:id',
  },
  routePrefixes: ['/inventario/registrar-ingreso'] as const,
  pages: {
    Management: lazy(() => import('@/components/IncomingMerchandiseManagement')),
    Create: lazy(() => import('@/pages/RegisterIncomingMerchandise')
      .then((module) => ({ default: module.RegisterIncomingMerchandise }))),
    Detail: lazy(() => import('@/pages/IncomingMerchandiseDetailPage')),
  },
} as const

import { lazy } from 'react'

export const merchandiseModule = {
  code: 'merchandise',
  dependencies: ['inventory', 'contacts'] as const,
  paths: {
    list: '/mercancia',
    create: '/inventario/registrar-ingreso',
    detail: '/mercancia/:id',
    payment: '/mercancia/pagos/nuevo',
    receipt: '/mercancia/pagos/:id',
  },
  routePrefixes: ['/inventario/registrar-ingreso'] as const,
  pages: {
    Management: lazy(() => import('./pages/IncomingMerchandiseManagement')),
    Create: lazy(() => import('./pages/RegisterIncomingMerchandise')
      .then((module) => ({ default: module.RegisterIncomingMerchandise }))),
    Detail: lazy(() => import('./pages/IncomingMerchandiseDetailPage')),
    Payment: lazy(() => import('./pages/SupplierPaymentPage')),
    Receipt: lazy(() => import('./pages/SupplierPaymentReceiptPage')),
  },
} as const

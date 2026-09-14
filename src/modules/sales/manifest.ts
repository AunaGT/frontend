import { lazy } from 'react'

export const salesModule = {
  code: 'sales',
  dependencies: ['inventory'] as const,
  paths: {
    list: '/ventas',
    create: '/ventas/nueva',
    invoice: '/ventas/:id/factura',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./SalesManagement')),
    Create: lazy(() => import('./NewSalePage')),
    Invoice: lazy(() => import('./SaleInvoicePage')
      .then((module) => ({ default: module.SaleInvoicePage }))),
  },
} as const

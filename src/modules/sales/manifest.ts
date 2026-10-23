import { lazy } from 'react'

export const salesModule = {
  code: 'sales',
  dependencies: ['inventory'] as const,
  paths: {
    list: '/ventas',
    create: '/ventas/nueva',
    pos: '/ventas/pos',
    edit: '/ventas/:id/editar',
    invoice: '/ventas/:id/factura',
    confirm: '/ventas/:id/confirmar',
    externalInvoice: '/ventas/:id/factura-externa',
    externalInvoiceEdit: '/ventas/:id/factura-externa/:documentId/editar',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./SalesManagement')),
    Create: lazy(() => import('./ManualSalePage')),
    Pos: lazy(() => import('./NewSalePage')),
    Confirm: lazy(() => import('./SaleConfirmationPage')),
    ExternalInvoice: lazy(() => import('./ExternalInvoicePage')),
    Invoice: lazy(() => import('./SaleInvoicePage')
      .then((module) => ({ default: module.SaleInvoicePage }))),
  },
} as const

import { lazy } from 'react'

export const receivablesModule = {
  code: 'receivables',
  dependencies: ['contacts'] as const,
  paths: { list: '/cartera', statement: '/cartera/:id' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./pages/CarteraPage')),
    SectionGuard: lazy(() => import('./pages/CarteraPage').then(module=>({default:module.CarteraSectionGuard}))),
    SupplierStatement: lazy(() => import('./pages/SupplierStatementPage')),
    SupplierPayment: lazy(() => import('./pages/SupplierPaymentPage')),
    SupplierReceipt: lazy(() => import('./pages/SupplierPaymentReceiptPage')),
    Statement: lazy(() => import('./pages/CustomerStatementPage')),
  },
} as const

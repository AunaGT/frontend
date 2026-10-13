import { lazy } from 'react'

export const receivablesModule = {
  code: 'receivables',
  dependencies: ['sales', 'contacts'] as const,
  paths: { list: '/cartera', statement: '/cartera/:id' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./pages/ReceivablesManagement')),
    Statement: lazy(() => import('./pages/CustomerStatementPage')),
  },
} as const

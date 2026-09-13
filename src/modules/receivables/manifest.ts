import { lazy } from 'react'

export const receivablesModule = {
  code: 'receivables',
  dependencies: ['sales', 'contacts'] as const,
  paths: { list: '/cartera', statement: '/cartera/:id' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('@/components/receivables/ReceivablesManagement')),
    Statement: lazy(() => import('@/components/receivables/CustomerStatementPage')),
  },
} as const

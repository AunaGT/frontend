import { lazy } from 'react'

export const transfersModule = {
  code: 'transfers',
  dependencies: ['inventory', 'branches'] as const,
  paths: { list: '/traslados' },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('./pages/TransfersManagement')) },
} as const

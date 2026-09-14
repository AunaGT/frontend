import { lazy } from 'react'

export const reportsModule = {
  code: 'reports',
  dependencies: ['sales', 'inventory'] as const,
  paths: { list: '/reportes' },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('./pages/ReportsManagement')) },
} as const

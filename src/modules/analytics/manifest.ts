import { lazy } from 'react'

export const analyticsModule = {
  code: 'analytics',
  dependencies: ['sales'] as const,
  paths: { list: '/analisis' },
  routePrefixes: ['/dashboard'] as const,
  pages: { Management: lazy(() => import('./pages/Analytics')) },
} as const

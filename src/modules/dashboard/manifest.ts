import { lazy } from 'react'

export const dashboardModule = {
  code: 'dashboard',
  dependencies: [] as const,
  paths: { list: '/dashboard' },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('@/components/Dashboard')) },
} as const

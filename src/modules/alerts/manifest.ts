import { lazy } from 'react'

export const alertsModule = {
  code: 'alerts',
  dependencies: ['inventory'] as const,
  paths: { list: '/alertas' },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('@/components/AlertsManagement')) },
} as const

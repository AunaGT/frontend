import { lazy } from 'react'

export const analyticsModule = {
  code: 'analytics',
  dependencies: ['sales'] as const,
  paths: { list: '/analisis' },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('@/components/Analytics')) },
} as const

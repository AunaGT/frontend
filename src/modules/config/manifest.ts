import { lazy } from 'react'

export const configModule = {
  code: 'config',
  dependencies: [] as const,
  protected: true,
  paths: { list: '/configuracion' },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('@/components/config/ConfigManagement')) },
} as const

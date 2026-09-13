import { lazy } from 'react'

export const branchesModule = {
  code: 'branches',
  dependencies: [] as const,
  paths: { list: '/sucursales' },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('./pages/BranchesManagement')) },
} as const

import { lazy } from 'react'

export const payrollModule = {
  code: 'payroll',
  dependencies: ['hr'] as const,
  paths: { list: '/nomina', detail: '/nomina/:id' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./pages/PayrollRunsManagement')),
    Detail: lazy(() => import('./pages/PayrollRunDetail')),
  },
} as const

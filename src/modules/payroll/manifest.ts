import { lazy } from 'react'

export const payrollModule = {
  code: 'payroll',
  dependencies: ['hr'] as const,
  paths: { list: '/nomina', detail: '/nomina/:id' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('@/components/payroll/PayrollRunsManagement')),
    Detail: lazy(() => import('@/components/payroll/PayrollRunDetail')),
  },
} as const

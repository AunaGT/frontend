import { lazy } from 'react'

export const hrModule = {
  code: 'hr',
  dependencies: ['branches'] as const,
  paths: {
    list: '/rrhh',
    create: '/rrhh/empleados/nuevo',
    detail: '/rrhh/empleados/:id',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('@/components/hr/HrPage')),
    Create: lazy(() => import('@/components/hr/EmployeeCreatePage')),
    Detail: lazy(() => import('@/components/hr/EmployeeDetailPage')),
  },
} as const

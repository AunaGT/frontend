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
    Management: lazy(() => import('./pages/HrPage')),
    Create: lazy(() => import('./pages/EmployeeCreatePage')),
    Detail: lazy(() => import('./pages/EmployeeDetailPage')),
  },
} as const

import { lazy } from 'react'

export const accountingModule = {
  code: 'accounting',
  dependencies: [] as const,
  paths: { list: '/contabilidad', import: '/contabilidad/importar' },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./components/AccountingManagement')),
    Import: lazy(() => import('./pages/AccountingImportPage')),
  },
} as const

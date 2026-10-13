import { lazy } from 'react'

export const contactsModule = {
  code: 'contacts',
  dependencies: [] as const,
  paths: {
    list: '/contactos',
    create: '/contactos/nuevo',
    import: '/contactos/importar',
    detail: '/contactos/:id',
    legacyList: '/proveedores',
    legacyCreate: '/proveedores/nuevo',
    legacyImport: '/proveedores/importar',
    legacyDetail: '/proveedores/:id',
  },
  routePrefixes: ['/proveedores'] as const,
  pages: {
    Management: lazy(() => import('./pages/SuppliersManagement')),
    Create: lazy(() => import('./components/SupplierCreatePage')),
    Import: lazy(() => import('./pages/SupplierImportPage')),
    Detail: lazy(() => import('./components/SupplierDetailPage')),
  },
} as const

import { lazy } from 'react'

export const contactsModule = {
  code: 'contacts',
  dependencies: [] as const,
  paths: {
    list: '/contactos',
    create: '/contactos/nuevo',
    import: '/contactos/importar',
    detail: '/contactos/:id',
  },
  routePrefixes: ['/proveedores'] as const,
  pages: {
    Management: lazy(() => import('@/components/SuppliersManagement')),
    Create: lazy(() => import('@/components/suppliers/SupplierCreatePage')),
    Import: lazy(() => import('@/pages/SupplierImportPage')),
    Detail: lazy(() => import('@/components/suppliers/SupplierDetailPage')),
  },
} as const

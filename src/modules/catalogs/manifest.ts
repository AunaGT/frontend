import { lazy } from 'react'

export const catalogsModule = {
  code: 'catalogs',
  dependencies: [] as const,
  label: 'Datos maestros',
  paths: {
    list: '/datos-maestros',
    import: '/datos-maestros/importar',
    legacyList: '/catalogos',
    legacyImport: '/catalogos/importar',
    categories: '/inventario/categorias',
    categoriesImport: '/inventario/categorias/importar',
    cashRegisters: '/configuracion/cajas',
    paymentMethods: '/configuracion/metodos-de-pago',
    paymentTerms: '/configuracion/condiciones-de-pago',
    paymentTermsImport: '/configuracion/condiciones-de-pago/importar',
  },
  routePrefixes: ['/catalogos'] as const,
  pages: {
    Panel: lazy(() => import('./pages/CatalogPanelPage')),
    Management: lazy(() => import('./pages/CatalogsManagement')
      .then((module) => ({ default: module.CatalogsManagement }))),
    Import: lazy(() => import('./pages/CatalogImportPage')),
  },
} as const

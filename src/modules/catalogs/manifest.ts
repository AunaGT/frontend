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
  },
  routePrefixes: ['/catalogos'] as const,
  pages: {
    Management: lazy(() => import('./pages/CatalogsManagement')
      .then((module) => ({ default: module.CatalogsManagement }))),
    Import: lazy(() => import('./pages/CatalogImportPage')),
  },
} as const

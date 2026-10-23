import { lazy } from 'react'
import { catalogsModule } from '../catalogs/manifest'

export const configModule = {
  code: 'config',
  dependencies: [] as const,
  protected: true,
  paths: { list: '/configuracion', templates:'/configuracion/plantillas', templateCreate:'/configuracion/plantillas/nueva', templateEdit:'/configuracion/plantillas/:id/editar', cashRegisters: catalogsModule.paths.cashRegisters, paymentMethods: catalogsModule.paths.paymentMethods, paymentTerms: catalogsModule.paths.paymentTerms, paymentTermsImport: catalogsModule.paths.paymentTermsImport },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('./pages/ConfigEntryPage')), Catalog: lazy(() => import('./pages/CatalogSettingsPage')), PaymentTermsImport: lazy(() => import('./pages/PaymentTermsImportPage')), DocumentTemplates:lazy(()=>import('./pages/DocumentTemplatesPage')),DocumentTemplateEditor:lazy(()=>import('./pages/DocumentTemplateEditorPage')) },
} as const

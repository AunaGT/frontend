import { lazy } from 'react'
import { catalogsModule } from '../catalogs/manifest'

export const configModule = {
  code: 'config',
  dependencies: [] as const,
  protected: true,
  paths: { list: '/configuracion', cashRegisters: catalogsModule.paths.cashRegisters, paymentMethods: catalogsModule.paths.paymentMethods, paymentTerms: catalogsModule.paths.paymentTerms, paymentTermsImport: catalogsModule.paths.paymentTermsImport },
  routePrefixes: [] as const,
  pages: { Management: lazy(() => import('./pages/ConfigManagement')), Catalog: lazy(() => import('./pages/CatalogSettingsPage')), PaymentTermsImport: lazy(() => import('./pages/PaymentTermsImportPage')) },
} as const

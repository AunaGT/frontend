import { accountingModule } from './accounting/manifest'
import { alertsModule } from './alerts/manifest'
import { analyticsModule } from './analytics/manifest'
import { branchesModule } from './branches/manifest'
import { cashClosureModule } from './cash-closure/manifest'
import { catalogsModule } from './catalogs/manifest'
import { configModule } from './config/manifest'
import { contactsModule } from './contacts/manifest'
import { dashboardModule } from './dashboard/manifest'
import { hrModule } from './hr/manifest'
import { inventoryCountModule } from './inventory-count/manifest'
import { inventoryModule } from './inventory/manifest'
import { merchandiseModule } from './merchandise/manifest'
import { ordersModule } from './orders/manifest'
import { payrollModule } from './payroll/manifest'
import { promotionsModule } from './promotions/manifest'
import { quotesModule } from './quotes/manifest'
import { receivablesModule } from './receivables/manifest'
import { reportsModule } from './reports/manifest'
import { returnsModule } from './returns/manifest'
import { salesModule } from './sales/manifest'
import { transfersModule } from './transfers/manifest'
import { usersModule } from './users/manifest'

export const MODULE_MANIFESTS = [
  dashboardModule,
  inventoryModule,
  catalogsModule,
  contactsModule,
  branchesModule,
  usersModule,
  configModule,
  salesModule,
  quotesModule,
  ordersModule,
  inventoryCountModule,
  returnsModule,
  cashClosureModule,
  receivablesModule,
  merchandiseModule,
  analyticsModule,
  accountingModule,
  reportsModule,
  alertsModule,
  promotionsModule,
  transfersModule,
  hrModule,
  payrollModule,
] as const

export type ModuleManifest = (typeof MODULE_MANIFESTS)[number]

export const MODULE_MANIFEST_BY_CODE = new Map<string, ModuleManifest>(
  MODULE_MANIFESTS.map((manifest) => [manifest.code, manifest])
)

/** Detecta manifiestos duplicados, dependencias inexistentes y ciclos al iniciar. */
export function assertModuleManifestCatalog() {
  if (MODULE_MANIFEST_BY_CODE.size !== MODULE_MANIFESTS.length) {
    throw new Error('Hay códigos de módulo duplicados en el catálogo del frontend')
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (code: string) => {
    if (visiting.has(code)) throw new Error(`Dependencia circular detectada en ${code}`)
    if (visited.has(code)) return
    const manifest = MODULE_MANIFEST_BY_CODE.get(code)
    if (!manifest) throw new Error(`El módulo ${code} no tiene manifiesto`)

    visiting.add(code)
    for (const dependency of manifest.dependencies) {
      if (!MODULE_MANIFEST_BY_CODE.has(dependency)) {
        throw new Error(`El módulo ${code} depende de ${dependency}, que no existe`)
      }
      visit(dependency)
    }
    visiting.delete(code)
    visited.add(code)
  }

  for (const manifest of MODULE_MANIFESTS) visit(manifest.code)
  return true
}

assertModuleManifestCatalog()

export {
  accountingModule,
  alertsModule,
  analyticsModule,
  branchesModule,
  cashClosureModule,
  catalogsModule,
  configModule,
  contactsModule,
  dashboardModule,
  hrModule,
  inventoryCountModule,
  inventoryModule,
  merchandiseModule,
  ordersModule,
  payrollModule,
  promotionsModule,
  quotesModule,
  receivablesModule,
  reportsModule,
  returnsModule,
  salesModule,
  transfersModule,
  usersModule,
}

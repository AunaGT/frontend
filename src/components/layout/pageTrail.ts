import { matchPath } from 'react-router-dom'
import { MODULE_MANIFEST_BY_CODE, usersModule, inventoryModule, hrModule, merchandiseModule } from '@/modules/catalog'

export type PageTrailItem = { label: string; to?: string; permissions?: readonly string[] }
export type ModuleOwner = { code: string; label: string; path: string }
export type PageTrailOverride = { owner: string; routeKey: string; items: PageTrailItem[] }

const listPermissions: Record<string, readonly string[]> = {
  sales: ['sales.view'], quotes: ['quotes.view'], orders: ['orders.view'], inventory: ['products.view'],
  'inventory-count': ['inventory_count.view'], merchandise: ['merchandise.view'], returns: ['returns.view'],
  contacts: ['contacts.suppliers.view', 'contacts.clients.view'], users: ['users.view', 'roles.manage'],
  hr: ['hr.employees.view', 'hr.attendance.view', 'hr.advances.view'], payroll: ['payroll.view'],
  receivables: ['receivables.view'], 'cash-closure': ['cashclosure.view'], transfers: ['transfers.view'],
  promotions: ['promotions.view', 'promotions.manage'], branches: ['branches.manage', 'companies.manage'],
  catalogs: ['catalogs.view', 'catalogs.manage'], alerts: ['alerts.view', 'alerts.manage'],
  config: ['settings.view', 'settings.manage'], analytics: ['analytics.view'], reports: ['reports.view'], accounting: ['accounting.view'],
}
const createLabels: Record<string, string> = {
  inventory: 'Nuevo producto', 'inventory-count': 'Nueva sesión', users: 'Nuevo usuario',
  hr: 'Nuevo empleado', merchandise: 'Registrar ingreso', contacts: 'Nuevo contacto',
  sales: 'Nueva venta', quotes: 'Nueva cotización', orders: 'Nuevo pedido', returns: 'Nueva devolución',
  'cash-closure': 'Nuevo cierre', promotions: 'Nueva promoción',
}

export function getRouteTrail(pathname: string, search: string, module?: ModuleOwner): PageTrailItem[] {
  if (pathname === '/mi-perfil') return [{ label: 'Mi perfil' }]
  if (!module || pathname === '/') return []
  const root: PageTrailItem = { label: module.label, to: module.path, permissions: listPermissions[module.code] }
  const trail = [root]
  const manifest = MODULE_MANIFEST_BY_CODE.get(module.code)
  const paths = manifest?.paths as Record<string, string> | undefined
  if (!paths) return trail
  if (paths.legacyList && (pathname === paths.legacyList || pathname.startsWith(paths.legacyList + '/'))) {
    pathname = paths.list + pathname.slice(paths.legacyList.length)
  }
  const matches = (pattern?: string) => !!pattern && !!matchPath({ path: pattern, end: true }, pathname)
  const roles = { label: 'Roles y permisos', to: usersModule.paths.roles, permissions: ['roles.view', 'roles.manage'] }
  if (module.code === 'users' && (pathname === roles.to || pathname.startsWith(roles.to + '/'))) {
    trail.push(roles)
    if (matches(usersModule.paths.roleCreate)) trail.push({ label: 'Nuevo rol' })
    else if (matches(usersModule.paths.roleDetail)) trail.push({ label: 'Detalle' })
  } else if (matches(paths.create) || matches(paths.legacyCreate)) {
    if (module.code === 'hr') trail.push({ label: 'Empleados', to: hrModule.paths.list, permissions: ['hr.employees.view'] })
    trail.push({ label: createLabels[module.code] || 'Nuevo registro' })
  } else if (matches(paths.import) || matches(paths.legacyImport)) trail.push({ label: 'Importar' })
  else if (matches(inventoryModule.paths.lots)) trail.push({ label: 'Lotes y caducidades' })
  else if (matches(inventoryModule.paths.movements)) trail.push({ label: 'Existencias y movimientos' })
  else if (matches(paths.deleted)) trail.push({ label: 'Productos eliminados' })
  else if (matches(paths.edit)) {
    trail.push({ label: 'Detalle' }, { label: 'Editar' })
  } else if (matches(paths.detail) || matches(paths.legacyDetail) || matches(paths.statement) || matches(paths.session) || matches(paths.invoice)) {
    if (module.code === 'hr') trail.push({ label: 'Empleados', to: hrModule.paths.list, permissions: ['hr.employees.view'] })
    trail.push({ label: matches(paths.statement) ? 'Estado de cuenta' : matches(paths.session) ? 'Sesión' : matches(paths.invoice) ? 'Factura' : 'Detalle' })
  } else if (matches(merchandiseModule.paths.create)) trail.push({ label: 'Registrar ingreso' })
  const query = new URLSearchParams(search)
  if (trail.length > 1 && trail.at(-1)?.label !== 'Editar' && (query.get('edit') === '1' || query.get('editar') === '1')) {
    trail[trail.length - 1] = { ...trail[trail.length - 1], to: pathname }
    trail.push({ label: 'Editar' })
  }
  return trail
}

export function selectPageTrail(routeKey: string, fallback: PageTrailItem[], override: PageTrailOverride | null): PageTrailItem[] {
  if (!override || override.routeKey !== routeKey || !override.items.length) return fallback
  // Local views describe their suffix; the canonical module/permissions always come from the route.
  const root = fallback[0]
  return root ? [root, ...override.items.filter((item, index) => index !== 0 || item.label !== root.label)] : override.items
}

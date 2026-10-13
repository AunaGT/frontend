import type { ReportFilters, ReportId } from './reportModel'
export type ReportDefinition = { id: ReportId; name: string; description: string; category: string; modules: string[]; permissions: string[]; period: boolean; locations?: boolean }
export const REPORT_CATEGORIES = ['Todos', 'Ventas y resultados', 'Compras y proveedores', 'Inventario y ubicaciones']
const stockPermissions = ['reports.view', 'stock_moves.view']
export const REPORT_CATALOG: ReportDefinition[] = [
  { id: 'sales', name: 'Ventas', description: 'Ingresos, devoluciones, tickets y métodos de pago.', category: REPORT_CATEGORIES[1], modules: ['sales'], permissions: ['reports.view'], period: true },
  { id: 'financial', name: 'Resultado del negocio', description: 'Ventas netas, costo y margen bruto. No es un estado contable.', category: REPORT_CATEGORIES[1], modules: ['sales', 'inventory'], permissions: ['reports.view'], period: true },
  { id: 'merchandise', name: 'Ingresos de mercadería', description: 'Costo recibido y estado de pago por proveedor.', category: REPORT_CATEGORIES[2], modules: ['merchandise'], permissions: ['merchandise.reports', 'reports.view'], period: true },
  { id: 'suppliers', name: 'Proveedores', description: 'Contactos, productos e inventario asociado actualmente.', category: REPORT_CATEGORIES[2], modules: ['contacts'], permissions: ['reports.view'], period: false },
  { id: 'inventory', name: 'Inventario actual', description: 'Existencias y valor a costo por sucursal y almacén.', category: REPORT_CATEGORIES[3], modules: ['inventory'], permissions: ['reports.view'], period: false },
  { id: 'products', name: 'Análisis de productos', description: 'Precios, márgenes y valor de las existencias actuales.', category: REPORT_CATEGORIES[3], modules: ['inventory'], permissions: ['reports.view'], period: false },
  { id: 'alerts', name: 'Pendientes y alertas', description: 'Reposición priorizada y alertas abiertas.', category: REPORT_CATEGORIES[3], modules: ['alerts'], permissions: ['reports.view'], period: false },
  { id: 'inventory-counts', name: 'Historial de inventariados', description: 'Conteos físicos, diferencias y merma.', category: REPORT_CATEGORIES[3], modules: ['inventory-count'], permissions: ['inventory_count.export', 'reports.view', 'inventory_count.view'], period: true },
  { id: 'stock-by-location', name: 'Existencias por almacén', description: 'Unidades y valor por almacén y ubicación.', category: REPORT_CATEGORIES[3], modules: ['inventory'], permissions: stockPermissions, period: false, locations: true },
  { id: 'kardex', name: 'Kardex por ubicación', description: 'Entradas, salidas y saldo registrado por ubicación.', category: REPORT_CATEGORIES[3], modules: ['inventory'], permissions: stockPermissions, period: true, locations: true },
  { id: 'internal-moves', name: 'Movimientos internos', description: 'Origen, destino y responsable; cada movimiento una vez.', category: REPORT_CATEGORIES[3], modules: ['inventory'], permissions: stockPermissions, period: true, locations: true },
  { id: 'replenishment', name: 'Reposición interna', description: 'Ubicaciones bajo mínimo y origen sugerido.', category: REPORT_CATEGORIES[3], modules: ['inventory'], permissions: stockPermissions, period: false, locations: true },
  { id: 'occupancy', name: 'Ocupación de ubicaciones', description: 'Ubicaciones vacías y productos almacenados.', category: REPORT_CATEGORIES[3], modules: ['inventory'], permissions: stockPermissions, period: false, locations: true },
]
export function applicableReportFilters(id: ReportId, filters: ReportFilters): ReportFilters {
  const definition = REPORT_CATALOG.find(r => r.id === id)
  if (!definition) throw new Error('Reporte no disponible.')
  const result: ReportFilters = { branchId: filters.branchId, period: definition.period ? filters.period : 'all' }
  if (!result.branchId || !['week', 'month', 'quarter', 'semester', 'year', 'all'].includes(result.period)) throw new Error('Selecciona una sucursal y período válidos.')
  if (definition.period && !['all', 'week'].includes(filters.period)) {
    if (!Number.isInteger(filters.year) || filters.year! < 1900 || filters.year! > 9998) throw new Error('El año no es válido.')
    result.year = filters.year
    const part = filters.period === 'month' ? 'month' : filters.period === 'quarter' ? 'quarter' : filters.period === 'semester' ? 'semester' : null
    if (part) {
      const max = part === 'month' ? 12 : part === 'quarter' ? 4 : 2
      if (!Number.isInteger(filters[part]) || filters[part]! < 1 || filters[part]! > max) throw new Error('El período no es válido.')
      result[part] = filters[part]
    }
  }
  if (definition.locations) {
    if (filters.warehouseId && filters.warehouseId !== 'all') result.warehouseId = filters.warehouseId
    if (filters.locationId && filters.locationId !== 'all') result.locationId = filters.locationId
  }
  if (id === 'kardex' && filters.productId) result.productId = filters.productId
  if(id==='products') {if(filters.catalogType && !['goods','services'].includes(filters.catalogType))throw new Error('Tipo de catálogo inválido.');result.catalogType=filters.catalogType || 'goods'}
  return result
}
export function reportFiltersKey(companyId: string, id: ReportId, filters: ReportFilters): string {
  try { return JSON.stringify([companyId, id, applicableReportFilters(id, filters)]) }
  catch { return JSON.stringify([companyId, id, filters]) }
}

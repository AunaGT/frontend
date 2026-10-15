import type { AnalyticsResponse } from './api/analyticsService'

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function calculateMargin(revenue: number, cost: number) {
  if (revenue <= 0) return 0
  return Number((((revenue - cost) / revenue) * 100).toFixed(1))
}

// Meses sin ventas ni costo quedan vacíos para que las líneas se corten en lugar de caer a cero.
export function buildMonthlySeries(monthly: AnalyticsResponse['monthly']) {
  return monthly.map((item) => {
    const ventas = item.ventasNetas ?? item.ventas - (item.devoluciones ?? 0)
    const empty = ventas === 0 && item.costo === 0
    return {
      month: MONTHS[item.month - 1],
      ventas,
      costo: item.costo,
      utilidad: empty ? null : ventas - item.costo,
      margen: ventas > 0 ? calculateMargin(ventas, item.costo) : null,
    }
  })
}

export type RankingRow = { label: string; value: number; share?: number; isOther?: boolean; detail?: string }

// Ordena de mayor a menor y agrupa la cola en una sola fila para no listar todas las categorías.
export function toRanking(rows: RankingRow[], limit: number, otherLabel: (count: number) => string): RankingRow[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const withShare = (row: RankingRow) => ({ ...row, share: total > 0 ? row.value / total : 0 })
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  if (sorted.length <= limit) return sorted.map(withShare)
  const tail = sorted.slice(limit - 1)
  const rest = tail.reduce((sum, row) => sum + row.value, 0)
  return [...sorted.slice(0, limit - 1).map(withShare), withShare({ label: otherLabel(tail.length), value: rest, isOther: true })]
}

export function buildInventorySegments(inventory: {
  productsCount: number
  lowStockCount: number
  outOfStockCount: number
}) {
  const low = Math.max(0, inventory.lowStockCount || 0)
  const out = Math.max(0, inventory.outOfStockCount || 0)
  const available = Math.max(0, (inventory.productsCount || 0) - low - out)

  return [
    { key: 'available', label: 'En stock', value: available },
    { key: 'low', label: 'Stock bajo', value: low },
    { key: 'out', label: 'Sin stock', value: out },
  ]
}

export type AnalyticsTab = 'resumen' | 'ventas' | 'productos' | 'inventario' | 'compras' | 'cartera'

export type AnalyticsSectionAccess = {
  inventory: boolean
  purchases: boolean
  receivables: boolean
}

export function buildAnalyticsTabs(access: AnalyticsSectionAccess): AnalyticsTab[] {
  const tabs: AnalyticsTab[] = ['resumen', 'ventas', 'productos']
  if (access.inventory) tabs.push('inventario')
  if (access.purchases) tabs.push('compras')
  if (access.receivables) tabs.push('cartera')
  return tabs
}

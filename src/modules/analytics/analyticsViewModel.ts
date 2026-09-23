export function calculateMargin(revenue: number, cost: number) {
  if (revenue <= 0) return 0
  return Number((((revenue - cost) / revenue) * 100).toFixed(1))
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

export function buildAnalyticsTabs(receivablesEnabled: boolean, canViewReceivables: boolean) {
  const tabs = ['resumen', 'ventas', 'productos', 'inventario', 'compras']
  if (receivablesEnabled && canViewReceivables) tabs.push('cartera')
  return tabs
}

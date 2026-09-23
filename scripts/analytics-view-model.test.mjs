import assert from 'node:assert/strict'
import test from 'node:test'

const moduleUrl = new URL('../src/modules/analytics/analyticsViewModel.ts', import.meta.url)

test('calcula margen e inventario sin producir valores negativos', async () => {
  const viewModel = await import(moduleUrl).catch(() => ({}))

  assert.equal(typeof viewModel.calculateMargin, 'function')
  assert.equal(typeof viewModel.buildInventorySegments, 'function')
  assert.equal(viewModel.calculateMargin(842350, 603480), 28.4)
  assert.equal(viewModel.calculateMargin(0, 0), 0)
  assert.deepEqual(
    viewModel.buildInventorySegments({ productsCount: 2480, lowStockCount: 548, outOfStockCount: 183 }),
    [
      { key: 'available', label: 'En stock', value: 1749 },
      { key: 'low', label: 'Stock bajo', value: 548 },
      { key: 'out', label: 'Sin stock', value: 183 },
    ],
  )
  assert.equal(viewModel.buildInventorySegments({ productsCount: 1, lowStockCount: 3, outOfStockCount: 2 })[0].value, 0)
})

test('muestra cartera solo cuando el módulo y el permiso están disponibles', async () => {
  const { buildAnalyticsTabs } = await import(moduleUrl)

  assert.deepEqual(buildAnalyticsTabs(false, false), ['resumen', 'ventas', 'productos', 'inventario', 'compras'])
  assert.deepEqual(buildAnalyticsTabs(true, false), ['resumen', 'ventas', 'productos', 'inventario', 'compras'])
  assert.deepEqual(buildAnalyticsTabs(true, true), ['resumen', 'ventas', 'productos', 'inventario', 'compras', 'cartera'])
})

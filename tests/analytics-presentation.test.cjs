const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const root = path.resolve(__dirname, '../src')
const cache = new Map(), overrides = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  cache.set(file, mod); mod.paths = Module._nodeModulePaths(path.dirname(file))
  const nativeRequire = mod.require.bind(mod)
  mod.require = name => {
    if (overrides.has(name)) return overrides.get(name)
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return nativeRequire(name)
    return load(['', '.tsx', '.ts', '.js', '/index.tsx', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), {fileName: file, compilerOptions: {target:ts.ScriptTarget.ES2020,jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true}}).outputText, file)
  return mod.exports
}

// Margin field left at 0 on purpose: the UI must derive it from revenue and cost.
const categories = Array.from({length: 12}, (_, i) => {
  const revenue = 1200 - i * 80, cost = i === 0 ? 990 : revenue * 0.7
  return {category: `Categoría ${i + 1}`, revenue, cost, profit: revenue - cost, margin: 0, percentage: 0}
})
const data = {
  year: 2026, firstSaleYear: 2025,
  availableSections: {sales: true, products: true, inventory: true, purchases: true, receivables: true},
  totals: {totalSales: 84103, totalReturns: 500, totalCost: 69344, totalProfit: 14759, productsCount: 76, stockRotation: 2273},
  monthly: Array.from({length: 12}, (_, i) => ({month: i + 1, ventas: i < 10 ? 8000 : 0, costo: i < 10 ? 6600 : 0, devoluciones: 0, ventasNetas: i < 10 ? 8000 : 0})),
  topProducts: [{id: 'p1', name: 'Producto con un nombre bastante largo para la lista', category: 'Categoría 1', ventas: 40, revenue: 900}],
  categoryPerformance: categories,
  paymentMethods: [{method: 'Efectivo', total: 60000, count: 300}, {method: 'Tarjeta', total: 24103, count: 90}],
  channels: [{channel: 'POS', label: 'Punto de venta', total: 84103, count: 390}],
  inventory: {stockValue: 336593, retailValue: 420000, potentialProfit: 83407, lowStockCount: 15, outOfStockCount: 6, productsCount: 101,
    byCategory: Array.from({length: 10}, (_, i) => ({category: `Categoría ${i + 1}`, value: 10000 - i * 500, units: 100 - i}))},
  purchases: {total: 50000, payableCount: 2, payablePending: 3000, monthly: Array.from({length: 12}, (_, i) => ({month: i + 1, amount: 4000})), topSuppliers: [{name: 'Proveedor A', amount: 30000}]},
  initialInventory: {total: 1000, units: 10, count: 1},
}

function setup({inventory = true} = {}) {
  overrides.set('@/hooks/useAuthPermissions', {useAuthPermissions: () => ({hasPermission: () => true})})
  overrides.set('@/hooks/useSystemSettings', {useSystemSettings: () => ({locale: 'es-GT', currencyCode: 'GTQ'})})
  overrides.set('@/context/useModules', {useModules: () => ({enabledModuleCodes: ['sales'], isEnabled: code => code !== 'inventory' || inventory})})
  overrides.set('@/modules/analytics/hooks/useAnalytics', {useAnalytics: () => ({data, isLoading: false, isFetching: false, isError: false, refetch() {}}), useAnalyticsFirstSaleYear: () => ({data: {firstSaleYear: 2025}})})
  overrides.set('@/components/layout/PageNavigation', {usePageTrail() {}})
  overrides.set('@tanstack/react-query', {useQuery: () => ({data: undefined, isLoading: false, isError: false, refetch() {}})})
  overrides.set('@/services/api', {apiFetch: () => Promise.resolve({})})
  cache.clear()
}
const reset = () => {overrides.clear(); cache.clear()}
const renderPage = options => {
  setup(options)
  const Page = load(path.join(root, 'modules/analytics/pages/Analytics.tsx')).default
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
}
// Radix only mounts the active tab; this stub mounts every tab so each one can be inspected.
const renderAllTabs = () => {
  setup()
  const box = tag => ({children, value}) => React.createElement(tag, value ? {'data-tab': value} : null, children)
  overrides.set('@/components/ui/tabs', {Tabs: box('div'), TabsList: box('div'), TabsTrigger: box('button'), TabsContent: box('section')})
  const {AnalyticsDetailTabs} = load(path.join(root, 'modules/analytics/components/AnalyticsDetailTabs.tsx'))
  const props = {data, isLoading: false, sectionAccess: {inventory: true, purchases: true, receivables: true}, formatCurrency: v => `Q ${v}`, formatCompactCurrency: v => `Q ${v}`, formatNumber: String, children: null}
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AnalyticsDetailTabs, props)))
  return tab => html.match(new RegExp(`<section data-tab="${tab}">[\\s\\S]*?(?=<section data-tab=|$)`))?.[0] ?? ''
}
const bodyRows = (html, label) => {
  const table = html.match(new RegExp(`<table[^>]*aria-label="${label}"[\\s\\S]*?</table>`))?.[0]
  assert.ok(table, `${label} renders as a table`)
  return (table.match(/<tbody[\s\S]*<\/tbody>/)?.[0].match(/<tr/g) || []).length
}

test('primary analytics empty sales uses the approved art with honest period context', () => {
  try {
    setup()
    overrides.set('@/modules/analytics/hooks/useAnalytics', { useAnalytics: () => ({ data: { ...data, totals: { ...data.totals, totalSales: 0 }, monthly: [] }, isLoading: false, isFetching: false, isError: false, refetch() {} }), useAnalyticsFirstSaleYear: () => ({ data: { firstSaleYear: 2025 } }) })
    const Page = load(path.join(root, 'modules/analytics/pages/Analytics.tsx')).default
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
    assert.match(html, /workspace-flat\.png/)
    assert.match(html, /Tus resultados están por tomar forma/)
    assert.match(html, new RegExp(String(new Date().getFullYear())))
    assert.doesNotMatch(html, /Aún no hay ventas en este período/)
  } finally { reset() }
})

test('rankings fold the tail into one "Otras" row and keep shares of the full total', () => {
  try {
    const {toRanking} = load(path.join(root, 'modules/analytics/analyticsViewModel.ts'))
    const rows = [['C', 10], ['A', 50], ['B', 20], ['E', 6], ['D', 10], ['F', 4]].map(([label, value]) => ({label, value}))
    assert.deepEqual(toRanking(rows, 4, count => `Otras ${count}`).map(({label, value, share, isOther}) => [label, value, share, Boolean(isOther)]), [
      ['A', 50, 0.5, false], ['B', 20, 0.2, false], ['C', 10, 0.1, false], ['Otras 3', 20, 0.2, true],
    ])
    assert.equal(toRanking(rows, 6, () => 'Otras').length, 6)
    assert.equal(toRanking([{label: 'A', value: 0}], 4, () => 'Otras')[0].share, 0)
  } finally {reset()}
})

test('monthly series leave profit and margin empty for months without activity', () => {
  try {
    const {buildMonthlySeries} = load(path.join(root, 'modules/analytics/analyticsViewModel.ts'))
    const [january, february] = buildMonthlySeries([
      {month: 1, ventas: 1100, costo: 825, devoluciones: 100, ventasNetas: 1000},
      {month: 2, ventas: 0, costo: 0},
    ])
    assert.deepEqual(january, {month: 'Ene', ventas: 1000, costo: 825, utilidad: 175, margen: 17.5})
    assert.equal(february.utilidad, null)
    assert.equal(february.margen, null)
  } finally {reset()}
})

test('resumen shows its KPIs in the shared metric strip, without icon tiles', () => {
  try {
    const html = renderPage()
    const strip = html.match(/<section[^>]*aria-label="Indicadores principales"[^>]*>[\s\S]*?<\/section>/)?.[0]
    assert.ok(strip, 'KPIs keep their accessible section')
    assert.match(strip, /class="metric-strip/)
    assert.equal((strip.match(/metric-strip-value/g) || []).length, 4)
    assert.doesNotMatch(html, /bg-brand-orange\/15/)
  } finally {reset()}
})

test('resumen hides the inventory health card, not the sales evolution, without inventory access', () => {
  try {
    const without = renderPage({inventory: false})
    assert.match(without, /Evolución de ventas/)
    assert.doesNotMatch(without, /Salud del inventario/)
    assert.match(renderPage({inventory: true}), /Salud del inventario/)
  } finally {reset()}
})

test('category profitability is a compact table of 8 rows that expands in place', () => {
  try {
    const products = renderAllTabs()('productos')
    assert.equal(bodyRows(products, 'Rentabilidad por categoría'), 8)
    assert.match(products, /17\.5%/)
    assert.match(products, /Ver las 12 categorías/)
    assert.doesNotMatch(products, /auna-section-row/)
  } finally {reset()}
})

test('inventory tab shows stock health and value per category as an expandable table', () => {
  try {
    const inventory = renderAllTabs()('inventario')
    assert.match(inventory, /Salud del inventario/)
    assert.match(inventory, /En stock[\s\S]*?80/)
    assert.equal(bodyRows(inventory, 'Valor por categoría'), 8)
    assert.match(inventory, /Ver las 10 categorías/)
  } finally {reset()}
})

test('metric strip alerts keep a readable red in dark mode', () => {
  try {
    const {MetricStrip} = load(path.join(root, 'components/shared/MetricStrip.tsx'))
    const html = renderToStaticMarkup(React.createElement(MetricStrip, {items: [{label: 'Saldo vencido', value: 'Q 4,800', alert: true}]}))
    assert.match(html, /metric-strip-value[^"]*dark:text-red-400/)
    assert.doesNotMatch(html, /text-destructive/)
  } finally {reset()}
})

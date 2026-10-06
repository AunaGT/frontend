import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()
const overrides = {}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = name => {
    if (name in overrides) return overrides[name]
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return require(name)
    return load(['', '.tsx', '.ts', '.js', '/index.ts'].map(ext => local + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()))
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
  return mod.exports
}

const { SalesStatusTable } = load(path.join(root, 'src/modules/sales/components/SalesStatusTable.tsx'))
const { SalesKPICards } = load(path.join(root, 'src/modules/sales/components/SalesKPICards.tsx'))
const { SalesFilters } = load(path.join(root, 'src/modules/sales/components/SalesFilters.tsx'))
const sale = { id: 'sale-1', reference: 'V-001', customer: 'Cliente visible', customerNit: '123456-7', isFinalConsumer: false, date: '2026-10-06T12:00:00Z', createdByName: 'Vendedor visible', status: 'completed', payment: 'Efectivo', isCredit: true, items: 2, total: 25, adjustedTotal: 0, hasReturns: true }
const base = { sales: [sale], pageInfo: { page: 2, totalPages: null, hasMore: true }, isLoading: false, updatingSaleIds: new Set(), onPageChange() {}, onStatusChange() {}, onViewSale() {}, onViewInvoice() {}, canChangeStatus: true, canViewDetail: true, canViewInvoice: true, locale: 'en-US', currencyCode: 'USD' }
const render = props => renderToStaticMarkup(React.createElement(SalesStatusTable, { ...base, ...props }))

test('all sales render a single real table with seller and preserve fully returned net zero', () => {
  const html = render()
  assert.equal((html.match(/<table\b/g) ?? []).length, 1)
  assert.equal((html.match(/<td\b/g) ?? []).length, 8)
  assert.match(html, /<th[^>]*>ID Venta<\/th>/)
  assert.match(html, /<th[^>]*>Vendedor<\/th>/)
  assert.match(html, /<th[^>]*>Total neto<\/th>/)
  assert.match(html, /Vendedor visible/)
  assert.match(html, /123456-7/)
  assert.match(html, /\$0\.00/)
  assert.match(html, /line-through[^>]*>\$25\.00/)
  assert.match(html, /A crédito/)
  assert.doesNotMatch(html, /role="combobox"|Fiado/)
})

test('card view has no table cells and applies the same action permissions and updating guard', () => {
  const html = render({ viewMode: 'cards', canViewDetail: false, canViewInvoice: true, canChangeStatus: false })
  assert.doesNotMatch(html, /<table\b|<td\b|Ver detalle|Más acciones/)
  assert.match(html, /Ver factura/)
  assert.match(html, /\$0\.00/)
  assert.match(html, /2 artículos/)
  const updating = render({ viewMode: 'cards', updatingSaleIds: new Set(['V-001']) })
  assert.match(updating, /<button[^>]*disabled=""[^>]*aria-label="Más acciones de V-001"/)
})

test('failed responses show a retry and never claim an empty list', () => {
  const html = render({ sales: [], error: 'Servicio no disponible', onRetry() {} })
  assert.match(html, /role="alert"/)
  assert.match(html, /Servicio no disponible/)
  assert.match(html, /Reintentar/)
  assert.doesNotMatch(html, /No hay ventas/)
  const stale = render({ error: 'Servicio no disponible', onRetry() {} })
  assert.match(stale, /Cliente visible/)
})

test('unknown totals retain next and previous controls without inventing a total', () => {
  const html = render()
  assert.match(html, /Página 2/)
  assert.match(html, /aria-label="Página anterior"/)
  assert.match(html, /aria-label="Página siguiente"/)
  assert.doesNotMatch(html, /Página 2 de|Mostrando/)
  const known = render({ pageInfo: { page: 1, totalPages: 3, totalItems: 23, hasMore: true } })
  assert.match(known, /Mostrando 1 a 1 de 23 ventas/)
  assert.match(known, /aria-current="page"/)
  const sized = render({ pageSize: 20, pageInfo: { page: 2, totalPages: 3, totalItems: 43, hasMore: true } })
  assert.match(sized, /Mostrando 21 a 21 de 43 ventas/)
})

test('status choices keep both transitions and route through the existing sale reference', () => {
  const nodes = []
  const walk = node => React.Children.forEach(node, child => {
    if (!React.isValidElement(child)) return
    nodes.push(child)
    walk(child.props.children)
  })
  const changes = []
  walk(SalesStatusTable({ ...base, viewMode: 'cards', onStatusChange: (...args) => changes.push(args) }))
  const choices = nodes.filter(node => typeof node.props.onSelect === 'function')
  assert.equal(choices.length, 2)
  for (const choice of choices) {
    assert.equal(choice.props.disabled, false)
    choice.props.onSelect()
  }
  assert.deepEqual(changes, [['V-001', 'completed'], ['V-001', 'cancelled']])
})

test('initial loading retains eight headings and skeleton rows, refetch retains sales', () => {
  const initial = render({ sales: [], isLoading: true })
  assert.equal((initial.match(/<td\b/g) ?? []).length, 41)
  assert.match(initial, /<th[^>]*>ID Venta<\/th>/)
  assert.doesNotMatch(initial, /No hay ventas/)
  const refreshing = render({ isFetching: true })
  assert.match(refreshing, /Cliente visible/)
  assert.match(refreshing, /role="status"/)
  assert.equal((refreshing.match(/<td\b/g) ?? []).length, 8)
})

test('summary names the selected period truthfully and does not show misleading zeroes while unavailable', () => {
  const props = { totalSalesToday: 25, transactionCountToday: 2, averageTicketToday: 12.5, preferredPaymentMethod: 'Efectivo', locale: 'en-US', currencyCode: 'USD' }
  const renderSummary = extras => renderToStaticMarkup(React.createElement(SalesKPICards, { ...props, ...extras }))
  const html = renderSummary()
  assert.match(html, /metric-strip/)
  assert.match(html, /Total neto/)
  assert.match(html, /Pago más frecuente/)
  assert.doesNotMatch(html, /Hoy|<svg/)
  const loading = renderSummary({ loading: true })
  assert.match(loading, /aria-busy="true"/)
  assert.doesNotMatch(loading, /\$25\.00/)
  const failed = renderSummary({ error: true })
  assert.doesNotMatch(failed, /\$25\.00|Efectivo/)
})

test('management uses the shared module heading, visible search and compact filters with one tabbed table', () => {
  Object.assign(overrides, {
    './hooks': { useSalesData: () => ({
      filters: { searchTerm: '', statusFilter: 'all', paymentFilter: 'all', period: 'today', isGlobalSearch: false },
      sales: [sale], pageInfo: { page: 1, totalPages: 1, totalItems: 1, hasMore: false },
      pageSize: 10, viewMode: 'table', totalSalesToday: 0, transactionCountToday: 1, averageTicketToday: 0, preferredPaymentMethod: 'Efectivo',
      setSearchTerm() {}, setStatusFilter() {}, setPaymentFilter() {}, setPeriod() {}, setPageSize() {}, setViewMode() {}, setPage() {}, refreshSales() {},
    }), normalizeRawSale: value => value },
    './components': { SalesKPICards, SalesFilters, SalesStatusTable, SaleDetailDialog: () => null, NegativeStockDialog: () => null },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/context/useAuth': { useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: permission => permission === 'sales.create' }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'en-US', currencyCode: 'USD' }) },
    '@/context/useModules': { useModules: () => ({ isEnabled: () => false }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [{ id: 1, name: 'Efectivo' }] }) },
    '@/hooks/useRealtimeSales': { useRealtimeSales() {} },
    '@/services/api': { getApiBaseUrl: () => '/api', getAuthToken: () => null },
    '@/services/salesService': { updateSaleStatus() {} },
    '@/services/saleService': { fetchSaleById() {} },
  })
  const { default: SalesManagement } = load(path.join(root, 'src/modules/sales/SalesManagement.tsx'))
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SalesManagement)))
  assert.match(html, /auna-module-heading/)
  assert.match(html, /auna-module-eyebrow[^>]*>Ventas/)
  assert.match(html, /<h1>Ventas<\/h1>/)
  assert.match(html, /bg-brand-orange[^>]*>.*?Nueva venta/)
  assert.match(html, /<label[^>]*for="sales-search"[^>]*>Buscar/)
  assert.match(html, /compact-filter-toolbar/)
  assert.match(html, /aria-label="Filtros de ventas"/)
  assert.match(html, /role="tab"[^>]*>Todas/)
  assert.match(html, /role="tab"[^>]*>Completadas/)
  assert.match(html, /role="tab"[^>]*>Canceladas/)
  assert.equal((html.match(/<table\b/g) ?? []).length, 1)
  assert.equal((html.match(/role="combobox"/g) ?? []).length, 1) // Only page size is visible.
  assert.doesNotMatch(html, /aria-label="Ver detalle|aria-label="Ver factura|Cierre de Caja/)
})

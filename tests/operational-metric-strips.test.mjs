import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '../src')
let state, calls = [], replenishmentMode = false, replenishmentRows = []
const overrides = new Map([
  ['@/context/useModules', {useModules:()=>({isEnabled:()=>true,isLoading:false,isError:false})}],
  ['react', { ...React, useState: initial => React.useState(replenishmentMode && initial === 'history' ? 'replenishment' : initial) }],
  ['@/services/api', { apiFetch: () => { throw new Error('Remote calls disabled') } }],
  ['./api', { apiFetch: () => { throw new Error('Remote calls disabled') } }],
  ['@/services/userService', {}],
  ['@/hooks/usePaymentTerms', { usePaymentTerms: () => ({ data: [] }) }],
  ['@/hooks/useSupplier', { useSupplier: () => ({}) }],
  ['@/hooks/useUpdateSupplier', { useUpdateSupplier: () => ({ isPending: false }) }],
  ['@/context/useAuth', { useAuth: () => ({ user: { id: 'user' } }) }],
  ['./hooks', { useCashClosureForm: () => ({ isSeller: false }), useCashClosureAPI: () => ({ closures: [], closureSummary: state.isError ? undefined : state.data?.summary, isLoadingClosures: state.isLoading, currentPage: 1, totalPages: 10, fetchClosures() {} }), useMineClosureGate: () => ({ gate: {} }), canRegisterMineClosure: () => true, mineClosureBlockedHint: () => '' }],
  ['./components', { ClosuresHistoryList: () => null }],
  ['./CashClosureCreatePage', { CASH_CLOSURE_CREATE_PATH: '/cierre-caja/nuevo' }],
  ['@tanstack/react-query', { useQuery: options => { calls.push(options); return options.queryKey[0] === 'stock-replenishment' ? { data: replenishmentRows } : ['users-role-options', 'warehouses'].includes(options.queryKey[0]) ? { data: [] } : state }, useMutation: () => ({ isPending: false }), useQueryClient: () => ({}) }],
  ['react-router-dom', { ...require('react-router-dom'), useNavigate: () => () => {} }],
  ['@/context/useTenant', { useTenant: () => ({ branch: { id: 'branch' }, company: { id: 'company' }, branches: [], companies: [] }) }],
  ['@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: () => true }) }],
  ['@/hooks/useSystemSettings', { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) }],
  ['@/hooks/use-toast', { useToast: () => ({ toast: () => {} }) }],
  ['@/hooks/useProducts', { useProducts: () => state, PRODUCTS_QUERY_KEY: ['products'] }],
  ['@/hooks/useCategories', { useCategories: () => ({ data: [] }) }],
  ['@/hooks/useSuppliers', { useSuppliers: () => state, useSupplier: () => ({}) }],
  ['@/hooks/usePersistedListUiState', { readListUiPersisted: () => ({}), usePersistedListUiState: () => ({ page: 1, pageSize: 10, viewMode: 'table', setPage() {}, setPageSize() {}, setViewMode() {} }), useResetPageOnFilterChange() {} }],
  ['@/components/layout/PageNavigation', { usePageTrail() {} }],
])
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file); cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = name => {
    if (overrides.has(name)) return overrides.get(name)
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return require(name)
    const resolved = ['', '.tsx', '.ts', '.js', '/index.tsx', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile())
    return load(resolved)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target:ts.ScriptTarget.ES2020,jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
  return mod.exports
}

test('replenishment summary counts the full filtered list before its ten-row page', () => {
  replenishmentMode = true
  replenishmentRows = Array.from({ length: 11 }, (_, index) => ({ product_id: `p${index}`, product_name: `Product ${index}`, location_id: `l${index}`, location_code: `L${index}`, warehouse_name: 'Warehouse', missing: 2, stock: 0, min_stock: 2, from_location_id: index < 9 ? 'source' : null, suggested_qty: 2 }))
  state = { data: { items: [] } }
  try {
    const Component = load(path.join(root, 'modules/inventory/stock/StockMovesPage.tsx')).StockMovesPage
    const html = renderToStaticMarkup(React.createElement(Component))
    const strip = html.slice(html.indexOf('aria-label="Resumen de reposición"')).split('</section>')[0]
    assert.match(strip, />11</)
    assert.match(strip, />9</)
    assert.match(strip, /Productos por reponer/)
    assert.equal((html.match(/<strong class="block font-medium">Product /g) || []).length, 10)
    assert.ok(html.indexOf('aria-label="Resumen de reposición"') < html.indexOf('aria-label="Buscar reposiciones"'))
  } finally { replenishmentMode = false; replenishmentRows = [] }
})

test('cash history hook requests filtered totals and clears stale summary on request failure', async t => {
  const hookFile = path.join(root, 'modules/cash-closure/hooks/useCashClosureAPI.ts')
  const oldReact = overrides.get('react'), oldApi = overrides.get('@/services/api'), oldPersisted = overrides.get('@/hooks/usePersistedListUiState')
  const values = []; let cursor = 0
  overrides.set('react', { useState: initial => { const index = cursor++; if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial; return [values[index], value => { values[index] = value }] }, useCallback: callback => callback, useEffect() {} })
  overrides.set('@/services/api', { getApiBaseUrl: () => '/api', getAuthToken: () => 'test' })
  overrides.set('@/hooks/usePersistedListUiState', { readListUiPersisted: () => ({}), writeListUiPersisted() {} })
  let requested, fail = false
  const fixture = { total: 91, Pendiente: 80, Aprobado: 10, Rechazado: 1 }
  t.mock.method(globalThis, 'fetch', async url => { requested = url; return { ok: !fail, status: 500, json: async () => ({ items: [], page: 2, totalPages: 10, summary: fixture }) } })
  t.mock.method(console, 'error', () => {})
  try {
    cache.delete(hookFile)
    const useHook = load(hookFile).useCashClosureAPI
    const renderHook = () => { cursor = 0; return useHook() }
    await renderHook().fetchClosures(2, false, 10, { status: 'Pendiente', startDate: '2026-10-01' })
    assert.deepEqual(renderHook().closureSummary, fixture)
    const query = new URL(requested, 'https://example.test').searchParams
    assert.equal(query.get('includeSummary'), 'true')
    assert.equal(query.get('status'), 'Pendiente')
    assert.equal(query.get('startDate'), '2026-10-01')
    assert.equal(query.get('pageSize'), '10')
    fail = true
    await renderHook().fetchClosures(2, false)
    assert.equal(renderHook().closureSummary, undefined)
  } finally { overrides.set('react', oldReact); overrides.set('@/services/api', oldApi); overrides.set('@/hooks/usePersistedListUiState', oldPersisted); cache.delete(hookFile) }
})
for (const [file, exported, label] of [
  ['modules/users/UserManagement.tsx', 'default', 'Resumen de usuarios'],
  ['modules/inventory/products/ProductManagement.tsx', 'default', 'Resumen de productos'],
  ['modules/inventory-count/pages/InventoryCountListPage.tsx', 'default', 'Resumen de conteos'],
  ['modules/inventory/stock/StockMovesPage.tsx', 'StockMovesPage', 'Resumen de movimientos'],
  ['modules/hr/pages/AdvancesManagement.tsx', 'AdvancesManagement', 'Resumen de anticipos'],
  ['modules/hr/pages/AttendanceSheet.tsx', 'AttendanceSheet', 'Marcas del período'],
  ['modules/contacts/pages/SuppliersManagement.tsx', 'default', 'Resumen de contactos'],
  ['modules/cash-closure/CashClosureManagement.tsx', 'default', 'Resumen de cierres'],
]) {
  test(`${file}: renders full-query totals and unavailable states`, () => {
    const Component = load(path.join(root, file))[exported]
    const render = () => renderToStaticMarkup(React.createElement(require('react-router-dom/server').StaticRouter, { location: '/' }, React.createElement(Component)))
    state = { data: { items: [], data: [], total: 91, totalItems: 91, page: 1, totalPages: 10, summary: { total: 91, ACTIVE: 70, INACTIVE: 20, BLOCKED: 1, active: 70, inactive: 21, forSale: 70, kits: 20, tracksExpiry: 1, DRAFT: 70, IN_PROGRESS: 20, IN_REVIEW: 1, PENDING_SECOND_APPROVAL: 0, APPROVED: 0, PENDIENTE: 70, PAGADO: 20, CANCELADO: 1, incoming: 70, outgoing: 21, PRESENTE: 70, TARDE: 20, AUSENTE: 1 } } }
    const html = render()
    assert.ok(html.includes(`aria-label="${label}"`), 'Missing summary strip')
    const filterIndex = html.indexOf('class="compact-filter-toolbar')
    if (filterIndex >= 0) assert.ok(html.indexOf(`aria-label="${label}"`) < filterIndex, 'Statistics must precede search and filters')
    if (label === 'Marcas del período') assert.ok(html.indexOf(`aria-label="${label}"`) < html.indexOf('aria-label="Ir a un mes"'))
    const strip = html.slice(html.indexOf(`aria-label="${label}"`)).split('</section>')[0]
    assert.match(strip, />91</)
    state = { isError: true, error: new Error('Unavailable'), data: state.data }
    const unavailable = render().slice(render().indexOf(`aria-label="${label}"`)).split('</section>')[0]
    assert.match(unavailable, /—/)
    assert.doesNotMatch(unavailable, />91</)
    state = { isLoading: true, isFetching: true }
    const loading = render()
    const loadingStrip = loading.slice(loading.indexOf(`aria-label="${label}"`)).split('</section>')[0]
    assert.match(loadingStrip, /aria-busy="true"/)
    assert.match(loadingStrip, /auna-skeleton/)
  })
}

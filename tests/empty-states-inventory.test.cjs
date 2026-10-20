const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { StaticRouter } = require('react-router-dom/server')

function contacts({ permission = true, state = {}, error = false, loading = false, view = 'cards' } = {}) {
  let index = 0
  const nodes = [], changes = [], navigations = []
  const Page = loadReportModule('../contacts/pages/SuppliersManagement.tsx', {
    react: { ...React, useState(initial) { const i = index++; return [Object.hasOwn(state, i) ? state[i] : initial, value => changes.push([i, value])] } },
    'react-router-dom': { useNavigate: () => value => navigations.push(value), useLocation: () => ({ state: null }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: code => permission || code.endsWith('.view') }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, viewMode: view, setPage() {}, setPageSize() {}, setViewMode() {} }), useResetPageOnFilterChange() {} },
    '@/hooks/useCardPagination': { useCardPagination: () => ({ pageSize: 12, pageSizeOptions: [12], containerRef() {}, setCardPageSize() {} }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [] }) },
    '@/hooks/useSuppliers': { useSuppliers: () => ({ data: { items: [], totalItems: 0, totalPages: 1, summary: { total: 0, active: 0, inactive: 0 } }, isLoading: loading, isError: error, refetch() {} }) },
    '@/services/api': { apiFetch() { throw Error('Unexpected network request') } },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(Page))
  return { html, nodes, changes, navigations }
}

const emptyNode = result => result.nodes.find(node => node.type?.name === 'CollectionEmptyState')

test('contacts offer the existing create route only when the initial empty collection permits creation', () => {
  for (const view of ['cards', 'table']) {
    const allowed = contacts({ view })
    assert.match(allowed.html, /workspace-flat\.png/)
    assert.ok(emptyNode(allowed).props.action)
    emptyNode(allowed).props.action.props.onClick()
    assert.deepEqual(allowed.navigations, ['/contactos/nuevo'])
    const denied = contacts({ permission: false, view })
    assert.match(denied.html, /workspace-flat\.png/)
    assert.ok(!emptyNode(denied).props.action)
    assert.doesNotMatch(denied.html, /Nuevo contacto/)
  }
})

test('contact search, inactive status, type and category produce a resettable filtered empty state', () => {
  for (const state of [{ 0: 'agua' }, { 1: 'SUPPLIER' }, { 2: '0' }, { 3: '4' }]) {
    const result = contacts({ state })
    const empty = emptyNode(result)
    assert.ok(empty, 'The collection has an illustrated empty state')
    assert.equal(empty.props.filtered, true)
    assert.match(result.html, /Busquemos por otro lado/)
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(empty.type, empty.props)), /Nuevo contacto/)
    empty.props.onReset()
    assert.ok(result.changes.some(([i, value]) => i === 0 && value === ''))
    assert.ok(result.changes.some(([i, value]) => i === 2 && value === 'all'))
  }
})

test('loading and failure retain their existing feedback instead of showing an illustrated empty collection', () => {
  assert.doesNotMatch(contacts({ loading: true }).html, /workspace-flat\.png/)
  const failure = contacts({ error: true }).html
  assert.match(failure, /Reintentar/)
  assert.doesNotMatch(failure, /workspace-flat\.png/)
})

test('product sales history is a compact readonly empty collection and keeps failure feedback', () => {
  for (const error of [false, true]) {
    const nodes = []
    const { ProductCommercialHistory } = loadReportModule('../inventory/products/ProductCommercialHistory.tsx', {
      '@tanstack/react-query': { useQuery: () => ({ data: { items: [] }, isLoading: false, isError: error }) },
      '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, setPage() {}, setPageSize() {} }) },
      '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
      '@/services/api': { apiFetch() { throw Error('Unexpected network request') } },
    }, nodes)
    const result = { nodes, html: renderToStaticMarkup(React.createElement(ProductCommercialHistory, { productId: 'qa' })) }
    if (error) { assert.match(result.html, /No se pudo cargar el historial/); assert.doesNotMatch(result.html, /workspace-flat\.png/); continue }
    assert.match(result.html, /workspace-flat\.png/)
    assert.equal(emptyNode(result).props.compact, true)
    assert.ok(!emptyNode(result).props.action)
    assert.doesNotMatch(result.html, /<button/)
  }
})

function collection(relative, { states = {}, allowed = true, branch = { id: 'qa', name: 'Principal' }, route = '/', view = 'table', queryData = { items: [], totalItems: 0, totalPages: 1, page: 1 }, queryFor, props = {}, exportName = 'default', mocks = {} } = {}) {
  let index = 0
  const nodes = [], changes = [], navigations = []
  const Page = loadReportModule(relative, {
    react: { ...React, useState(initial) { const i = index++; return [Object.hasOwn(states, i) ? states[i] : initial, value => changes.push([i, value])] } },
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => value => navigations.push(value), useSearchParams: () => [new URLSearchParams(route.split('?')[1]), () => {}], useParams: () => ({ id: 'qa', sessionId: 'qa' }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => allowed }) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'qa-user' } }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala', inventoryServicesEnabled: true }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company' }, branch, branches: branch ? [branch] : [], isConsolidated: !branch }) },
    '@/context/useModules': { useModules: () => ({ enabledModuleCodes: new Set(['inventory']), isLoading: false, isError: false }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, viewMode: view, setPage() {}, setPageSize() {}, setViewMode() {} }), useResetPageOnFilterChange() {} },
    '@/hooks/useCardPagination': { useCardPagination: () => ({ pageSize: 10, pageSizeOptions: [10], containerRef() {}, setCardPageSize() {} }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/hooks/useProducts': { useProducts: () => ({ data: queryData }), PRODUCTS_QUERY_KEY: ['products'] },
    '@/hooks/useCategories': { useCategories: () => ({ data: [] }) },
    '../hooks/useIncomingMerchandise': { useIncomingMerchandise: () => ({ data: queryData, isLoading: false, isError: false, refetch() {} }) },
    '../manifest': { inventoryModule: { paths: { categories: '/inventario/categorias' } } },
    '@tanstack/react-query': { useInfiniteQuery: () => ({ data: { pages: [] }, isFetching: false, isError: false }), useQuery: options => ({ data: options.queryKey[0] === 'warehouses' ? [] : queryFor ? queryFor(options.queryKey) : queryData, isLoading: false, isError: false, isFetching: false, refetch() {} }), useMutation: () => ({ isPending: false, mutate() {} }), useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/services/api': { apiFetch() { throw Error('Unexpected network request') }, getApiBaseUrl: () => '/api' },
    './api': { apiFetch() { throw Error('Unexpected network request') }, getApiBaseUrl: () => '/api' },
    ...mocks,
  }, nodes)[exportName]
  const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: route }, React.createElement(Page, props)))
  return { html, nodes, changes, navigations }
}

test('goods and services reuse their own create routes and inventory scopes suppress empty-state creation', () => {
  for (const [route, target] of [['/inventario', '/inventario/nuevo'], ['/inventario?tipo=services', '/inventario/nuevo?tipo=services']]) {
    const initial = collection('../inventory/products/ProductManagement.tsx', { route })
    assert.match(initial.html, /workspace-flat\.png/)
    emptyNode(initial).props.action.props.onClick()
    assert.deepEqual(initial.navigations, [target])
    assert.ok(!emptyNode(collection('../inventory/products/ProductManagement.tsx', { allowed: false, route })).props.action)
  }
  for (const states of [{ 0: 'agua' }, { 1: 'Bebidas' }, { 8: 'qa' }, { 9: 'warehouse' }, { 10: 'location' }]) {
    const filtered = collection('../inventory/products/ProductManagement.tsx', { states })
    assert.equal(emptyNode(filtered).props.filtered, true)
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(emptyNode(filtered).type, emptyNode(filtered).props)), /Nuevo producto/)
    emptyNode(filtered).props.onReset()
    for (const [i, value] of [[0, ''], [1, 'all'], [8, 'all'], [9, 'all'], [10, 'all']]) assert.ok(filtered.changes.some(change => change[0] === i && change[1] === value))
  }
})

test('count sessions keep the valid creation link and treat status alone as a filter', () => {
  const relative = '../inventory-count/pages/InventoryCountListPage.tsx'
  const initial = collection(relative, { queryData: { data: [], total: 0 } })
  assert.match(initial.html, /colSpan="7"/i)
  assert.match(renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' }, emptyNode(initial).props.action)), /href="\/inventario\/inventariado\/nuevo"/)
  assert.ok(!emptyNode(collection(relative, { allowed: false, queryData: { data: [], total: 0 } })).props.action)
  const filtered = collection(relative, { states: { 2: 'APPROVED' }, queryData: { data: [], total: 0 } })
  assert.equal(emptyNode(filtered).props.filtered, true)
  assert.match(filtered.html, /Limpiar filtros/)
})

test('transfers respect the branch prerequisite and treat origin, destination and status as filters in either view', () => {
  const relative = '../transfers/pages/TransfersManagement.tsx'
  for (const view of ['table', 'cards']) {
    const initial = collection(relative, { exportName: 'TransfersManagement', view })
    assert.ok(emptyNode(initial).props.action)
    emptyNode(initial).props.action.props.onClick()
    assert.ok(initial.changes.some(([, value]) => value === true))
    for (const options of [{ allowed: false }, { branch: null }]) assert.ok(!emptyNode(collection(relative, { ...options, exportName: 'TransfersManagement', view })).props.action)
    for (const states of [{ 0: 'RECIBIDA' }, { 1: 'qa' }, { 2: 'qa' }, { 3: 'agua' }]) {
      const filtered = collection(relative, { states, exportName: 'TransfersManagement', view })
      assert.equal(emptyNode(filtered).props.filtered, true)
      assert.doesNotMatch(renderToStaticMarkup(React.createElement(emptyNode(filtered).type, emptyNode(filtered).props)), /Nuevo traslado/)
    }
  }
})

test('lot lists expose readonly empties and count location, date-window and status filters', () => {
  for (const states of [{}, { 0: 'expired' }, { 1: '60' }, { 2: 'agua' }, { 3: 'location' }]) {
    const result = collection('../inventory/pages/LotsExpiryPage.tsx', { states, exportName: 'LotsExpiryPage', queryData: { lots: [] } })
    assert.match(result.html, /workspace-flat\.png/)
    assert.ok(!emptyNode(result).props.action)
    assert.equal(emptyNode(result).props.filtered, Object.keys(states).length > 0)
  }
  for (const states of [{}, { 0: 'lot' }, { 1: 'expired' }, { 2: 'location' }]) {
    const result = collection('../inventory/products/ProductLotsSection.tsx', { states, exportName: 'ProductLotsSection', queryData: { lots: [] }, props: { productId: 'qa', tracksExpiry: true } })
    assert.equal(emptyNode(result).props.compact, true)
    assert.ok(!emptyNode(result).props.action)
    assert.equal(emptyNode(result).props.filtered, Object.keys(states).length > 0)
  }
})

test('merchandise entries use their existing intake route and dates and payment state suppress empty creation', () => {
  const relative = '../merchandise/pages/IncomingMerchandiseManagement.tsx'
  const initial = collection(relative)
  emptyNode(initial).props.action.props.onClick()
  assert.deepEqual(initial.navigations, ['/inventario/registrar-ingreso'])
  for (const states of [{ 0: 'agua' }, { 3: 'supplier' }, { 4: '2026-10-01' }, { 5: '2026-10-15' }, { 8: 'PENDING' }]) {
    const filtered = collection(relative, { states })
    assert.equal(emptyNode(filtered).props.filtered, true)
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(emptyNode(filtered).type, emptyNode(filtered).props)), /Nueva entrada/)
  }
})

test('count lines with pending and location filters never claim the entire count is finished', () => {
  const relative = '../inventory-count/pages/InventoryCountSessionPage.tsx'
  const session = { id: 'qa', status: 'IN_PROGRESS', createdBy: { id: 'qa-user', name: 'Operador' }, created_at: '2026-10-16T12:00:00Z', progress: { totalLines: 10, countedLines: 4, pct: 40 }, scope_json: {}, _count: { lines: 10 } }
  const result = collection(relative, { states: { 0: 'agua', 2: true, 3: 'location' }, queryFor: key => key[0] === 'inventory-session' ? session : { data: [], total: 0 } })
  assert.equal(emptyNode(result).props.filtered, true)
  assert.doesNotMatch(result.html, /conteo completo ya está|No quedan filas sin guardar/)
  emptyNode(result).props.onReset()
  for (const [i, value] of [[0, ''], [1, ''], [2, false], [3, 'all']]) assert.ok(result.changes.some(change => change[0] === i && change[1] === value))
  for (const allowed of [true, false]) {
    const draft = collection(relative, { allowed, queryFor: key => key[0] === 'inventory-session' ? { ...session, status: 'DRAFT', _count: { lines: 0 } } : { data: [], total: 0 } })
    assert.equal(Boolean(emptyNode(draft).props.action), allowed)
    assert.equal(emptyNode(draft).props.compact, true)
  }
})

test('product and contact catalog pickers reserve illustrated empties for successful queries and retry failed catalogs', () => {
  const product = { id: 'qa', name: 'Producto QA', category: '', supplier: '', stock: 0, minStock: 0, price: 10, cost: 0, kind: 'STANDARD', availableForSale: true }
  const supplier = { id: 'qa', name: 'Proveedor QA', party_type: 'SUPPLIER', status: 'active', estado: 1, paymentTermsList: [], productsList: [] }
  for (const relative of ['../inventory/products/ProductCreatePage.tsx', '../inventory/products/ProductDetailPage.tsx', '../contacts/components/SupplierCreatePage.tsx', '../contacts/components/SupplierDetailPage.tsx']) {
    for (const status of ['loading', 'error', 'empty']) {
      const retries = []
      const result = collection(relative, { route: '/?editar=1', states: relative.includes('ProductDetailPage') ? { 0: product } : {}, mocks: {
        '@/hooks/useCategories': { useCategories: () => ({ data: status === 'empty' ? [] : undefined, isLoading: status === 'loading', isError: status === 'error', refetch: () => retries.push('categories') }) },
        '@/hooks/useSuppliers': { useSuppliers: () => ({ data: status === 'empty' ? { items: [] } : undefined, isLoading: status === 'loading', isError: status === 'error', refetch: () => retries.push('suppliers') }) },
        '@/hooks/usePaymentTerms': { usePaymentTerms: () => ({ data: status === 'empty' ? { items: [] } : undefined, isLoading: status === 'loading', isError: status === 'error', refetch: () => retries.push('terms') }) },
        '@/hooks/useSupplier': { useSupplier: () => ({ data: supplier, isLoading: false, isError: false }) },
        '@/services/supplierService': { adaptApiSupplier: value => value, SUPPLIERS_DROPDOWN_PARAMS: {} },
        '@/hooks/useCreateSupplier': { useCreateSupplier: () => ({ isPending: false }) },
        '@/hooks/useUpdateSupplier': { useUpdateSupplier: () => ({ isPending: false }) },
        '@/hooks/useDeleteSupplier': { useDeleteSupplier: () => ({ isPending: false }) },
        '@/hooks/useCreateProduct': { useCreateProduct: () => ({ isPending: false }) },
        '@/hooks/useUpdateProduct': { __esModule: true, default: () => ({ isPending: false }) },
        '@/hooks/useDeleteProduct': { useDeleteProduct: () => ({ isPending: false }), useRemoveProductFromBranch: () => ({ isPending: false }) },
        '@/hooks/useCustomerSales': { useCustomerSales: () => ({ data: { items: [] } }) },
        '@/modules/merchandise': { useIncomingMerchandise: () => ({ data: { items: [] } }), useIncomingMerchandiseById: () => ({ data: null }) },
        '@/modules/sales': { normalizeRawSale: value => value, SaleDetailDialog: () => null },
        '@/modules/appointments/useServiceScheduleDraft': { useServiceScheduleDraft: () => ({ allowed: false, ready: true, dirty: false, payload: {} }) },
        '@/modules/appointments/components/DraftGuard': { useDraftGuard: () => ({}) },
        './hooks/useKitAssemblePrompt': { useKitAssemblePrompt: () => ({ offerAssemble() {}, promptDialog: null }) },
      } })
      const menus = result.nodes.filter(node => node.props.className === 'w-[320px] p-0')
      const originalNodes = [...result.nodes]
      assert.equal(menus.length, 2, relative)
      const html = menus.map(node => renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' }, node.props.children))).join('')
      if (status === 'empty') { assert.match(html, /workspace-flat\.png/, relative); continue }
      assert.doesNotMatch(html, /workspace-flat\.png|Configura las categorías|Registra un contacto|Configura categorías en Inventario/, relative)
      if (status === 'loading') assert.match(html, /Cargando categorías/, relative)
      else {
        assert.match(html, /role="alert"/, relative)
        assert.match(html, /Reintentar/, relative)
        for (const node of originalNodes.filter(node => node.props.children === 'Reintentar')) node.props.onClick()
        assert.deepEqual(retries.sort(), relative.includes('/inventory/') ? ['categories', 'suppliers'] : ['categories', 'terms'], relative)
      }
    }
  }
})

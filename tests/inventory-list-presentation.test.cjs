const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')

const product = { id: 'qa-product', name: 'Bebida QA 330 ml', category: 'Bebidas', brand: 'QA', size: '330 ml', stock: 24, minStock: 5, price: 25.5, cost: 12, supplier: 'Proveedor QA', barcode: '7401001000098', description: '', imageUrl: '/qa-bottle.png', status: 'available', availableForSale: true, inBranch: true, kind: 'STANDARD' }

function renderList({ view = 'table', permissions = ['products.view', 'products.edit'], products = [product], loading = false, error = false, states = {}, totalPages = 2, pagination, servicesEnabled=false, route='/inventario' } = {}) {
  let index = 0
  const nodes = [], changes = [], navigations = [], queries = [], mutations = [], reads = []
  const Page = loadReportModule('../inventory/products/ProductManagement.tsx', {
    ...(pagination ? { '@/hooks/useCardPagination': { useCardPagination: () => pagination } } : {}),
    react: { ...React, useState: initial => {
      const key = index++, [value, setValue] = React.useState(Object.hasOwn(states, key) ? states[key] : initial)
      return [value, next => { changes.push({ key, value: typeof next === 'function' ? next(value) : next }); setValue(next) }]
    } },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, viewMode: view, setPage: v => changes.push({ page: v }), setPageSize: v => changes.push({ pageSize: v }), setViewMode: v => changes.push({ view: v }) }), useResetPageOnFilterChange() {} },
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => (path, options) => navigations.push({ path, options }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/context/useTenant': { useTenant: () => ({ branches: [{ id: 'qa-branch', name: 'Principal' }] }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.some(code => permissions.includes(code)) }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ',inventoryServicesEnabled:servicesEnabled }) },
    '@/components/layout/PageNavigation': {usePageTrail(){}},
    '@/hooks/useProducts': { PRODUCTS_QUERY_KEY: ['products'], useProducts: options => { reads.push(options); return { data: { items: products, totalItems: totalPages === 1 ? products.length : 36, totalPages, page: 1, nextPage: totalPages > 1 ? 2 : null, prevPage: null, summary: { total: 36, forSale: 35, kits: 2, tracksExpiry: 5 } }, isLoading: loading, isFetching: false, isError: error, refetch() {} } } },
    '@/hooks/useCategories': { useCategories: () => ({ data: [{ id: 1, name: 'Bebidas' }] }) },
    '@/services/productService': { adaptApiProduct: p => p, fetchAllProducts() { throw Error('No real export or products query') }, addProductToBranch() { throw Error('No real stock changes') } },
    '@/services/warehouseService': { fetchWarehouses() { throw Error('No real warehouse query') } },
    '@/services/stockMoveService': { fetchStockByLocation() { throw Error('No real stock query') } },
    '@/services/api': { apiFetch() { throw Error('No real requests') } },
    '@tanstack/react-query': {
      useQuery: options => { queries.push(options); return { data: options.queryKey[0] === 'stock-by-location' ? [{ stock: 24, location: { id: 'loc-qa', code: 'A-01', warehouse: { name: 'Bodega', branch: { name: 'Principal' } } } }] : [], isLoading: false } },
      useMutation: options => ({ isPending: false, mutate: value => mutations.push({ options, value }) }), useQueryClient: () => ({ invalidateQueries() {} }),
    },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, {initialEntries:[route]}, React.createElement(Page)))
  return { html, nodes, changes, navigations, queries, mutations, reads }
}
test('service catalog uses server filtering, sale availability and unit instead of stock, with metrics above search',()=>{
  const service={...product,kind:'SERVICE',stock:0,minStock:0,cost:0,serviceUnitLabel:'Hora',quantityDecimals:2}
  const result=renderList({servicesEnabled:true,route:'/inventario?tipo=services',view:'cards',products:[service]})
  assert.equal(result.reads[0].catalogType,'services')
  assert.equal(result.reads[0].branchId,undefined)
  assert.match(result.html,/Disponible para venta/)
  assert.match(result.html,/Hora/)
  assert.doesNotMatch(result.html,/Sin Stock|Mín:|Costo:|24 unidades/)
  assert.ok(result.html.indexOf('Con cantidades fraccionadas')<result.html.indexOf('compact-filter-toolbar'))
  assert.equal(result.queries.find(query=>query.queryKey[0]==='warehouses').enabled,false)
  assert.equal(renderList({route:'/inventario?tipo=services'}).reads[0].catalogType,'goods')
})

test('inventory table uses a readable code, thumbnail and shared named actions preserving edit permission', () => {
  const result = renderList()
  assert.match(result.html, /7401001000098/)
  assert.match(result.html, /src="\/qa-bottle.png"/)
  assert.match(result.html, /aria-label="Ver detalles de Bebida QA 330 ml"/)
  assert.match(result.html, /aria-label="Editar Bebida QA 330 ml"/)
  result.nodes.find(n => n.props['aria-label'] === 'Ver detalles de Bebida QA 330 ml').props.onClick({ stopPropagation() {} })
  result.nodes.find(n => n.props['aria-label'] === 'Editar Bebida QA 330 ml').props.onClick({ stopPropagation() {} })
  assert.deepEqual(result.navigations.map(n => n.path), ['/inventario/qa-product', '/inventario/qa-product?editar=1'])
  assert.doesNotMatch(renderList({ permissions: ['products.view'] }).html, /aria-label="Editar|Costo:/)
  assert.doesNotMatch(renderList({ permissions: ['products.view', 'products.create'] }).html, /aria-label="Editar/, 'El acceso a editar debe coincidir con el permiso de la ficha')
})

test('inventory cards navigate as a whole without view/edit buttons and keep full-height media', () => {
  const result = renderList({ view: 'cards' })
  assert.doesNotMatch(result.html, /<table/)
  assert.match(result.html, /product-card/)
  assert.match(result.html, /auna-record-grid/)
  assert.match(result.html, /auna-record-card/)
  assert.match(result.html, /auna-record-media/)
  assert.match(result.html, /object-contain/)
  assert.doesNotMatch(result.html, /object-cover|shadow-orange/)
  for (const value of ['7401001000098', 'Bebidas', 'QA', '330 ml', '24', '5']) assert.ok(result.html.includes(value), value)
  assert.doesNotMatch(result.html, /aria-label="Ver detalles de|aria-label="Editar/)
  const card = result.nodes.find(n => n.props.className?.includes('product-card auna-surface'))
  assert.equal(card.props.role, 'button')
  assert.ok(card.props.className.includes('auna-record-interactive'))
  const heading = result.nodes.find(n => n.props.className === 'product-card-heading')
  assert.ok(heading, 'Name and status share the header, not a third card column')
  assert.match(renderToStaticMarkup(React.createElement('div', null, heading.props.children)), /Bebida QA 330 ml.*Disponible/)
  assert.doesNotMatch(result.html, /product-card-actions/)
  const grid = result.nodes.find(n => n.props.className === 'auna-record-grid')
  assert.equal(typeof grid.props.ref, 'function', 'Measure inside the scroller, including scrollbar width')
  card.props.onClick({})
  card.props.onKeyDown({ key: 'Enter', preventDefault() {} })
  card.props.onKeyDown({ key: ' ', preventDefault() {} })
  assert.deepEqual(result.navigations.map(n => n.path), Array(3).fill('/inventario/qa-product'))
  assertPaginationOutside(result.html)
})

test('inventory queries and selector use the measured card size instead of the table preference', () => {
  const sizes = []
  const pagination = { pageSize: 12, pageSizeOptions: [12, 24, 36, 48], containerRef() {}, setCardPageSize: value => sizes.push(value) }
  const result = renderList({ view: 'cards', pagination })
  assert.equal(result.reads[0].pageSize, 12)
  const select = result.nodes.find(n => n.props.value === '12' && n.props.onValueChange)
  select.props.onValueChange('24')
  assert.deepEqual(sizes, [24])
  assert.equal(result.changes.some(change => 'pageSize' in change), false, 'Card selection must not overwrite table preference')
  assert.equal(result.nodes.find(n => n.props.className === 'auna-record-grid').props.ref, pagination.containerRef)
})

test('inventory selection still reaches exports and changing views clears only selection', () => {
  const result = renderList({ states: { 5: ['qa-product'] }, permissions: ['products.view', 'products.export'] })
  const exportDialog = result.nodes.find(n => n.type?.name === 'ExportDialog')
  assert.ok(exportDialog.props.summary.includes('1 producto(s) seleccionados'))
  const tabs = result.nodes.find(n => n.type?.name === 'ModuleTabBar')
  tabs.props.onValueChange('cards')
  assert.deepEqual(result.changes, [{ view: 'cards' }, { key: 5, value: [] }])
  assertPaginationOutside(result.html)
})

test('stock breakdown spans the new action column and continues to query only expanded products', () => {
  assert.equal(renderList().queries.filter(q => q.queryKey[0] === 'stock-by-location').length, 0)
  const expanded = renderList({ states: { 11: 'qa-product' } })
  assert.match(expanded.html, /colSpan="7"/i)
  assert.match(expanded.html, /A-01/)
  assert.deepEqual(expanded.queries.find(q => q.queryKey[0] === 'stock-by-location').queryKey, ['stock-by-location', 'qa-product'])
})

test('missing product photo and barcode use truthful fallbacks without hiding stock or branch actions', () => {
  const result = renderList({ view: 'cards', products: [{ ...product, imageUrl: undefined, barcode: '', inBranch: false }] })
  assert.match(result.html, /Sin código/)
  assert.match(result.html, /Sin imagen de Bebida QA 330 ml/)
  assert.match(result.html, /src="\/placeholder.svg"/)
  assert.match(result.html, /No se maneja aquí/)
  result.nodes.find(n => n.props.children?.some?.(child => child === 'Manejar aquí')).props.onClick({ stopPropagation() {} })
  assert.equal(result.mutations.length, 1)
  assert.equal(result.mutations[0].value.id, 'qa-product')
})

test('inventory has one table frame with its toolbar and pagination outside, retaining summaries and query scope', () => {
  const result = renderList()
  assert.ok(result.html.indexOf('Resumen de productos') < result.html.indexOf('compact-filter-toolbar'))
  assert.ok(result.html.indexOf('Vista de productos') < result.html.indexOf('auna-data-table-shell'))
  assert.equal((result.html.match(/auna-data-table-shell/g) || []).length, 1)
  assert.match(result.html, /role="region" aria-label="Productos del inventario" tabindex="0"/i)
  assertPaginationOutside(result.html)
  assert.deepEqual(result.reads[0], { catalogType:'goods',includeSummary: true, page: 1, pageSize: 10, search: undefined, category: undefined, branchId: 'all', warehouseId: undefined, locationId: undefined, inBranchOnly: undefined })
  assert.match(result.html, />36<\/strong>/)
})

test('failed images recover to the product fallback and a changed source can load again', () => {
  const result = renderList({ view: 'cards' })
  const image = result.nodes.find(n => n.type === 'img' && n.props.src === product.imageUrl)
  assert.ok(image)
  assert.equal(typeof image.props.onError, 'function')
  image.props.onError()
  const failure = result.changes.at(-1)
  const states = { [failure.key]: failure.value }
  assert.match(renderList({ view: 'cards', states }).html, /Sin imagen de Bebida QA 330 ml/)
  const changed = renderList({ view: 'cards', states, products: [{ ...product, imageUrl: '/qa-new-bottle.png' }] })
  assert.match(changed.html, /src="\/qa-new-bottle.png"/)
})

function renderDetail(editable, query = 'editar=1', states = {}, item=product, servicesEnabled=true) {
  let index = 0
  const nodes = [], params = [], effects = []
  const Page = loadReportModule('../inventory/products/ProductDetailPage.tsx', {
    '@/modules/appointments/useServiceScheduleDraft': { useServiceScheduleDraft: () => ({ allowed: false, ready: true, payload: {}, reset() {}, async reload() {} }) },
    react: { ...React, useState: initial => { const key = index++; return React.useState(Object.hasOwn(states, key) ? states[key] : key === 0 ? item : initial) }, useEffect: (run, deps) => effects.push({ run, deps }) },
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => () => {}, useParams: () => ({ id: product.id }), useSearchParams: () => [new URLSearchParams(query), (next, options) => params.push({ query: next.toString(), options })] },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: code => editable && code === 'products.edit' }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', inventoryServicesEnabled:servicesEnabled }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/context/useTenant': { useTenant: () => ({ branch: { id: 'qa', name: 'Principal' }, branches: [] }) },
    '@/services/productService': { adaptApiProduct: p => p, fetchProductById() { throw Error('No real product reads') } },
    '@/services/supplierService': { SUPPLIERS_DROPDOWN_PARAMS: {} },
    '@/services/api': { getApiBaseUrl: () => '/api', apiFetch() { throw Error('No real requests') } },
    './api': { getApiBaseUrl: () => '/api', apiFetch() { throw Error('No real requests') } },
    '@/hooks/useSuppliers': { useSuppliers: () => ({ data: { items: [] } }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [] }) },
    '@/hooks/useUpdateProduct': { __esModule: true, default: () => ({ isPending: false, mutateAsync() { throw Error('No real product writes') } }) },
    '@/hooks/useDeleteProduct': { useDeleteProduct: () => ({ isPending: false }), useRemoveProductFromBranch: () => ({ isPending: false }) },
    '@tanstack/react-query': { useQuery: () => ({ data: undefined, isLoading: false, isError: false }), useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }) },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
  return { html, nodes, params, effects }
}

test('direct edit navigation opens the existing editor only with its permission', () => {
  const editor = renderDetail(true)
  assert.match(editor.html, /class="record-edit"/)
  assert.match(editor.html, /Guardar cambios/)
  const readonly = renderDetail(false)
  assert.doesNotMatch(readonly.html, /class="record-edit"|Guardar cambios/)
  assert.match(readonly.html, /Bebida QA 330 ml/)
  assert.doesNotMatch(renderDetail(true, '').html, /class="record-edit"/)
})
test('a historical service remains readable without opening an editor while services are disabled',()=>{
  const service={...product,kind:'SERVICE',serviceUnitLabel:'Hora',quantityDecimals:2}
  const result=renderDetail(true,'editar=1',{},service,false)
  assert.doesNotMatch(result.html,/class="record-edit"|Guardar cambios/)
  assert.match(result.html,/desactivados/);assert.match(result.html,/Hora/)
})
test('service details and editing mount no lot, location or kit views and show billing rules instead',()=>{
  const service={...product,kind:'SERVICE',stock:0,cost:0,serviceUnitLabel:'Hora',quantityDecimals:2}
  const detail=renderDetail(true,'',{},service)
  assert.match(detail.html,/Unidad de cobro/)
  assert.match(detail.html,/Hora/)
  assert.doesNotMatch(detail.html,/Stock actual|Stock mínimo|Lotes y caducidades|Kit \/ combo|Margen de ganancia/)
  assert.equal(detail.nodes.some(n=>['ProductLotsSection','ProductLocationsSection','ProductKitSection'].includes(n.type?.name)),false)
  const editor=renderDetail(true,'editar=1',{},service)
  assert.match(editor.html,/service-unit/)
  assert.doesNotMatch(editor.html,/edit-stock|edit-min-stock|edit-supplier-label|edit-tracks-expiry/)
})

test('leaving or denying direct edit replaces only its query flag without reopening the editor', () => {
  for (const result of [renderDetail(false, 'editar=1&origin=list'), renderDetail(true, 'editar=1&origin=list', { 4: false })]) {
    result.effects.find(effect => effect.deps?.[1] instanceof URLSearchParams).run()
    assert.deepEqual(result.params, [{ query: 'origin=list', options: { replace: true } }])
  }
  for (const result of [renderDetail(true, 'editar=1&origin=list'), renderDetail(true, 'origin=list')]) {
    result.effects.find(effect => effect.deps?.[1] instanceof URLSearchParams).run()
    assert.deepEqual(result.params, [])
  }
})

test('inventory density keeps horizontal photos and metadata without shrinking shared controls', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/modules/inventory/products/productList.css'), 'utf8')
  assert.doesNotMatch(css, /grid-template-rows:\s*auto 1fr auto auto/)
  assert.match(css, /\.product-list-table\s*>\s*tbody\s*>\s*tr\s*>\s*td\s*\{\s*padding:\s*12px 16px;/)
  const table = renderList()
  assert.match(table.html, /h-10 w-10 shrink-0/)
  assert.match(table.html, /product-list-metadata/)
  const cards = renderList({ view: 'cards' })
  assert.match(cards.html, /auna-record-card product-card-content/)
  for (const label of ['7401001000098', 'QA', '330 ml', 'Precio', 'Mín:']) assert.ok(cards.html.includes(label), label)
})

test('single-page inventory still shows its range outside results and multipage controls navigate', () => {
  const result = renderList({ view: 'cards', totalPages: 1 })
  assertPaginationOutside(result.html)
  assert.match(result.html, /Mostrando 1 a 1 de 1 productos/)
  const multiple = renderList()
  const next = multiple.nodes.find(n => n.props['aria-label'] === 'Página siguiente')
  next.props.onClick()
  assert.deepEqual(multiple.changes, [{ page: 2 }])
})

const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { StaticRouter } = require('react-router-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const salesProps = { sales: [], pageInfo: { page: 1, totalPages: 1, hasMore: false, totalItems: 0 }, isLoading: false, updatingSaleIds: new Set(), onPageChange() {}, canChangeStatus: false, onStatusChange() {}, onViewSale() {}, onViewInvoice() {}, canViewDetail: false, canViewInvoice: false }
function renderSales(extra = {}) {
  const nodes = []
  const { SalesStatusTable } = loadReportModule('../sales/components/SalesStatusTable.tsx', {}, nodes)
  const html = renderToStaticMarkup(React.createElement(SalesStatusTable, { ...salesProps, ...extra }))
  return { html, nodes }
}

test('sales initial empty state illustrates the collection and retains its permitted next action', () => {
  const { html } = renderSales({ action: React.createElement('a', { href: '/ventas/nueva' }, 'Nueva venta') })
  assert.match(html, /workspace-flat.png/)
  assert.match(html, /href="\/ventas\/nueva"/)
  assert.match(html, /<thead>/)
})

test('sales filtered state replaces creation with an executable reset', () => {
  let resets = 0
  const { html, nodes } = renderSales({ filtered: true, onReset: () => resets++, action: React.createElement('a', { href: '/ventas/nueva' }, 'Nueva venta') })
  assert.match(html, /Busquemos por otro lado/)
  assert.doesNotMatch(html, /href="\/ventas\/nueva"/)
  nodes.find(node => node.props.children === 'Limpiar filtros' && node.props.onClick).props.onClick()
  assert.equal(resets, 1)
})

test('sales loading and errors take precedence over illustrated emptiness', () => {
  for (const props of [{ isLoading: true }, { error: 'Consulta interrumpida', onRetry() {} }]) {
    const { html } = renderSales(props)
    assert.doesNotMatch(html, /workspace-flat.png/)
    if (props.error) { assert.match(html, /role="alert"/); assert.match(html, /Reintentar/) }
  }
})

test('cash closure history remains readonly and uses compact artwork', () => {
  const { ClosuresHistoryList } = loadReportModule('../cash-closure/components/ClosuresHistoryList.tsx', {
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
  })
  const props = { closures: [], isLoading: false, isSeller: false, currentPage: 1, totalPages: 1, onViewClosure() {}, onPageChange() {} }
  const html = renderToStaticMarkup(React.createElement(ClosuresHistoryList, props))
  assert.match(html, /workspace-flat.png/)
  assert.match(html, /width="96" height="64"/)
  assert.doesNotMatch(html, /<button|<a\s/)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ClosuresHistoryList, { ...props, isLoading: true })), /workspace-flat.png/)
})

test('cart search emptiness can clear the search without inventing a sale', () => {
  const nodes = []; let search
  const { CartPanel } = loadReportModule('../sales/components/CartPanel.tsx', { '@/services/api': {} }, nodes)
  const html = renderToStaticMarkup(React.createElement(CartPanel, { cartItems: [], cartTotal: 0, productSearch: 'ausente', onProductSearchChange: value => { search = value }, filteredProducts: [], isLoadingProducts: false, onAddToCart() {}, onRemoveFromCart() {}, onUpdateQuantity() {}, amountReceived: '', onAmountReceivedChange() {}, changeAmount: 0 }))
  assert.equal((html.match(/workspace-flat.png/g) || []).length, 2)
  assert.match(html, /Busquemos por otro lado/)
  nodes.find(node => node.props.children === 'Limpiar filtros' && node.props.onClick).props.onClick()
  assert.equal(search, '')
  assert.doesNotMatch(html, /Nueva venta/)
})

test('valid quote collections illustrate empty lines in both internal and public views', () => {
  const { QuoteLines } = loadReportModule('../quotes/QuotePresentation.tsx', { './api': {} })
  for (const compact of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(QuoteLines, { lines: [], money: String, compact }))
    assert.match(html, /workspace-flat.png/)
    assert.match(html, /width="96" height="64"/)
    assert.doesNotMatch(html, /Nueva cotización/)
    if (!compact) assert.match(html, /<thead\b/)
  }
})

function renderList(path, { allowed = true, filteredState, error = false, data, token } = {}) {
  const nodes = [], queries = [], changes = [], navigations = []; let stateIndex = 0
  const emptyQuery = { data: data || { items: [], totalItems: 0, page: 1, pageSize: 10, totalPages: 1 }, isLoading: false, isFetching: false, isError: error, refetch() {} }
  const mocks = {
    '@/services/api': {}, './api': {},
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'company' }, branch: { id: 'branch' }, branches: [] }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => allowed }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', timezone: 'America/Guatemala' }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => route => navigations.push(route), useParams: () => ({ token }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, setPage() {}, setPageSize() {} }), useResetPageOnFilterChange() {} },
    '@/hooks/useCardPagination': { useCardPagination: () => ({ pageSize: 10, pageSizeOptions: [10], containerRef() {}, setCardPageSize() {} }) },
    '../hooks/useReturns': { useReturns: () => emptyQuery, useUpdateReturnStatus: () => ({ isPending: false }), useCreateReturn: () => ({ isPending: false }) },
    '@tanstack/react-query': { useQuery: options => { queries.push(options); return options.queryKey[0] === 'promotion-types' ? { ...emptyQuery, data: [] } : emptyQuery }, useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }) },
    react: { ...React, useState: initial => { const index = stateIndex++; const value = filteredState && Object.hasOwn(filteredState, index) ? filteredState[index] : initial; return [typeof value === 'function' ? value() : value, next => changes.push({ index, next })] } },
  }
  const Page = loadReportModule(path, mocks, nodes).default
  const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' }, React.createElement(Page)))
  return { html, nodes, changes, queries, navigations }
}

for (const [path, label, route] of [
  ['../quotes/QuotesManagement.tsx', 'Nueva cotización', '/cotizaciones/nueva'],
  ['../orders/pages/OrdersManagement.tsx', 'Nuevo pedido', '/pedidos/nuevo'],
  ['../returns/pages/ReturnsManagement.tsx', 'Nueva devolución', '/returns/new'],
  ['../promotions/pages/PromotionsListPage.tsx', 'Nueva promoción', '/promociones/nueva'],
]) {
  test(`${label}: empty list uses artwork and respects creation permission`, () => {
    const { html, nodes, navigations } = renderList(path)
    assert.match(html, /workspace-flat.png/)
    const empty = nodes.find(node => node.props.action && node.props.title && node.props.description)
    assert.ok(empty, 'The empty collection offers the existing creation action')
    assert.match(renderToStaticMarkup(empty.props.action), new RegExp(label))
    empty.props.action.props.onClick()
    assert.deepEqual(navigations, [route])
    assert.doesNotMatch(renderList(path, { allowed: false }).html, new RegExp(label))
    const failed = renderList(path, { error: true }).html
    assert.doesNotMatch(failed, /workspace-flat.png/)
    assert.match(failed, /Reintentar/)
  })
}

test('promotion scope and dates count as filters and reset all criteria', () => {
  const { html, nodes, changes } = renderList('../promotions/pages/PromotionsListPage.tsx', { filteredState: { 3: 'specific', 4: '2026-10-01', 5: '2026-10-16' } })
  assert.match(html, /Busquemos por otro lado/)
  nodes.find(node => node.props.children === 'Limpiar filtros' && node.props.onClick).props.onClick()
  assert.ok(changes.some(change => change.index === 3 && change.next === 'all'))
  assert.ok(changes.some(change => change.index === 4 && change.next === ''))
  assert.ok(changes.some(change => change.index === 5 && change.next === ''))
})

test('promotion branch selection illustrates unavailable branches without a fake create action', () => {
  const { PromotionBranchesField } = loadReportModule('../promotions/pages/PromotionBranchesField.tsx', { '@/context/useTenant': { useTenant: () => ({ branches: [], branch: null }) } })
  const html = renderToStaticMarkup(React.createElement(PromotionBranchesField, { appliesToAll: false, branchIds: [], onAppliesToAllChange() {}, onBranchIdsChange() {} }))
  assert.match(html, /workspace-flat.png/)
  assert.doesNotMatch(html, /Nueva sucursal/)
})

test('eligible return sales distinguish initial emptiness from a search and preserve failure', () => {
  const initial = renderList('../returns/pages/NewReturn.tsx')
  assert.match(initial.html, /workspace-flat.png/)
  assert.doesNotMatch(initial.html, /Nueva venta/)
  const filtered = renderList('../returns/pages/NewReturn.tsx', { filteredState: { 0: 'cliente' } })
  assert.match(filtered.html, /Busquemos por otro lado/)
  filtered.nodes.find(node => node.props.children === 'Limpiar filtros' && node.props.onClick).props.onClick()
  assert.ok(filtered.changes.some(change => change.index === 0 && change.next === ''))
  assert.doesNotMatch(renderList('../returns/pages/NewReturn.tsx', { error: true }).html, /workspace-flat.png/)
})

test('public order illustrates only a valid empty collection and leaves unavailable links unillustrated', () => {
  const data = { id: 'order', reference: 'P-1', status: 'DRAFT', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z', lines: [], sales: [], company_name: 'Empresa QA', total: 0, subtotal: 0, fulfillment_mode: 'SEPARATE' }
  assert.match(renderList('../orders/pages/PublicOrderPage.tsx', { token: 'valid', data }).html, /workspace-flat.png/)
  const unavailable = renderList('../orders/pages/PublicOrderPage.tsx').html
  assert.match(unavailable, /Pedido no disponible/)
  assert.doesNotMatch(unavailable, /workspace-flat.png/)
})

test('sale detail empty products use compact artwork and keep the financial table separate', () => {
  const { SaleDetailContent } = loadReportModule('../sales/components/SaleDetailContent.tsx', {
    '@/services/api': {},
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => false }) },
    '@/context/useModules': { useModules: () => ({ isEnabled: () => true }) },
  })
  const sale = { id: 'sale', date: '2026-10-01T12:00:00Z', status: 'completed', customer: 'CF', isFinalConsumer: true, products: [], total: 0 }
  const html = renderToStaticMarkup(React.createElement(SaleDetailContent, { sale }))
  assert.match(html, /workspace-flat.png/)
  assert.match(html, /width="96" height="64"/)
  assert.match(html, /aria-label="Resumen de pago"/)
})

test('promotion categories illustrate an empty catalog but never a failed lookup', () => {
  for (const isError of [false, true]) {
    const { PromotionApplicableScopeFields } = loadReportModule('../promotions/pages/PromotionApplicableScopeFields.tsx', {
      '@/hooks/useSystemSettings': { useSystemSettings: () => ({ inventoryServicesEnabled: false }) },
      '@/hooks/useProductCategories': { useProductCategories: () => ({ data: { items: [] }, isLoading: false, isError, refetch() {} }) },
      '@tanstack/react-query': { useQuery: () => ({ data: [] }) },
      '@/components/shared/ProductCombobox': { ProductCombobox: () => null },
      '@/services/productService': {},
    })
    const html = renderToStaticMarkup(React.createElement(PromotionApplicableScopeFields, { products: [], categories: [], onProductsChange() {}, onCategoriesChange() {} }))
    if (isError) { assert.doesNotMatch(html, /workspace-flat.png/); assert.match(html, /Reintentar/) }
    else assert.match(html, /workspace-flat.png/)
  }
})

test('cash picker illustrates no configured registers but preserves loading and failure gates', () => {
  for (const [loading, error] of [[false, null], [true, null], [false, 'Sin conexión']]) {
    let index = 0
    const values = [[], loading, error]
    const { CashRegisterPicker } = loadReportModule('../sales/CashRegisterPicker.tsx', {
      react: { ...React, useState: initial => [index < values.length ? values[index++] : initial, () => {}] },
      '@/context/useAuth': { useAuth: () => ({ user: { id: 'u' } }) },
      '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => false }) },
      '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
      '@/services/cashSessionsService': {},
    })
    const html = renderToStaticMarkup(React.createElement(CashRegisterPicker, { onSelect() {}, onBack() {} }))
    if (loading || error) assert.doesNotMatch(html, /workspace-flat.png/)
    else { assert.match(html, /workspace-flat.png/); assert.match(html, /Volver a ventas/); assert.doesNotMatch(html, /Nueva caja/) }
    if (error) assert.match(html, /Reintentar/)
  }
})

test('return detail empty lines retain the table headers and compact readonly guidance', () => {
  const record = { id: 'return-1', sale_id: 'sale-1', return_date: '2026-10-01T12:00:00Z', status: { name: 'Completada' }, total_refund: 0, return_items: [], replacement_items: [], settlements: [] }
  const mutation = { isPending: false }
  const Page = loadReportModule('../returns/pages/ReturnDetailPage.tsx', {
    '@/services/api':{},
    'react-router-dom': { useParams: () => ({ id: record.id }), useNavigate: () => () => {} },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => false }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [] }) },
    '../hooks/useReturns': { useReturnById: () => ({ data: record }), useUpdateReturnStatus: () => mutation, useApproveReturn: () => mutation, useCompleteReturn: () => mutation },
    '@tanstack/react-query': { useQuery: () => ({ data: [] }) },
    '@/services/warehouseService': {}, '@/services/cashSessionsService': {},
  }).default
  const html = renderToStaticMarkup(React.createElement(Page))
  assert.match(html, /workspace-flat.png/)
  assert.match(html, /colSpan="6"|colspan="6"/)
  assert.match(html, /<thead\b/)
  assert.doesNotMatch(html, /Registrar devolución|Revisar y aprobar/)
})

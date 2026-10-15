const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const settings = { locale: 'en-US', currencyCode: 'USD', timezone: 'UTC' }
const commonMocks = {
  '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
  '@/hooks/useSystemSettings': { useSystemSettings: () => settings },
  '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
  '@/services/api': { apiFetch() { throw new Error('No network in record presentation tests') } },
  './api': { apiFetch() { throw new Error('No network in record presentation tests') } },
}
const sale = { id: 'sale-1', reference: 'V-001', customer: 'Cliente con nombre extenso', customerNit: '123456-7', isFinalConsumer: false, date: '2026-10-06T12:00:00Z', createdByName: 'Vendedor visible', status: 'completed', payment: 'Efectivo', isCredit: true, items: 2, total: 25, adjustedTotal: 0, hasReturns: true }
const merchandise = { id: 'record-12345', date: '2026-10-06T12:00:00Z', supplier: { id: 'supplier-1', name: 'Proveedor con nombre extenso', contact: 'Contacto visible' }, itemsCount: 2, totalValue: 25, payment_status: 'PARTIAL', payment_term: { id: 'term-1', name: 'Crédito 30 días' } }
const transfer = { id: 'transfer-1', reference: 'TR-001', status: 'EN_TRANSITO', from_branch_id: 'origin', to_branch_id: 'destination', fromBranch: { id: 'origin', name: 'Sucursal origen con nombre extenso' }, toBranch: { id: 'destination', name: 'Sucursal destino con nombre extenso' }, sent_at: '2026-10-06T12:00:00Z', lines: [{ id: 'line-1', product_id: 'product-1', qty_sent: 7, qty_received: null, product: { id: 'product-1', name: 'Producto visible', image_url: '/product.jpg' } }], notes: null }

function renderModule(relative, exportName, mocks, props = {}) {
  const nodes = []
  const Component = loadReportModule(relative, { ...commonMocks, ...mocks }, nodes)[exportName]
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)))
  return { html, nodes }
}
function region(nodes, className) {
  const node = nodes.find(node => node.props?.className?.split(' ').includes(className))
  assert.ok(node, `Records must expose their ${className} region`)
  return renderToStaticMarkup(React.createElement('div', null, node.props.children))
}
function assertHorizontal({ html, nodes }) {
  assert.match(html, /class="[^"]*auna-record-grid\b/)
  assert.match(html, /class="[^"]*auna-record-card\b/)
  assert.doesNotMatch(region(nodes, 'auna-record-content'), /<img\b|<svg\b|truncate|line-clamp/)
  assert.doesNotMatch(html, /auna-record-media/)
}
function renderSales(extras = {}) {
  return renderModule('../sales/components/SalesStatusTable.tsx', 'SalesStatusTable', {}, {
    sales: [sale], viewMode: 'cards', pageInfo: { page: 1, totalPages: 1, totalItems: 1, hasMore: false }, isLoading: false, updatingSaleIds: new Set(),
    onPageChange() {}, onStatusChange() {}, onViewSale() {}, onViewInvoice() {}, canChangeStatus: true, canViewDetail: true, canViewInvoice: true, ...settings, ...extras,
  })
}
function renderMerchandise({ allowed = true, state = {}, navigate = () => {}, mocks = {} } = {}) {
  return renderModule('../merchandise/pages/IncomingMerchandiseManagement.tsx', 'default', {
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => navigate },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: permission => permission === 'merchandise.details' ? allowed : true }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, viewMode: 'cards', setPage() {}, setPageSize() {}, setViewMode() {} }), useResetPageOnFilterChange() {} },
    '../hooks/useIncomingMerchandise': { useIncomingMerchandise: () => ({ data: { items: [merchandise], totalItems: 1, totalPages: 1 }, isLoading: false, isFetching: false, isError: false, refetch() {}, ...state }) },
    ...mocks,
  })
}
function renderTransfers(state = {}, mocks = {}) {
  return renderModule('../transfers/pages/TransfersManagement.tsx', 'TransfersManagement', {
    '@/context/useTenant': { useTenant: () => ({ branch: { id: 'origin', name: 'Origen' }, branches: [] }) },
    '@tanstack/react-query': { useQuery: options => options.queryKey[0] === 'transfers' ? { data: { items: [transfer], totalItems: 1, totalPages: 1, page: 1, pageSize: 10 }, isLoading: false, isFetching: false, isError: false, refetch() {}, ...state } : { data: [] }, useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }) },
    '../transferViewModel': { ...loadReportModule('../transfers/transferViewModel.ts'), initialTransferView: () => 'cards' },
    '@/services/tenantService': {}, '@/services/productService': {}, '@/services/warehouseService': {}, '@/utils/pdfBranding': {},
    ...mocks,
  })
}

test('sales cards place complete identification left and net zero, status and existing actions right', () => {
  const seen = []
  const result = renderSales({ onViewSale: value => seen.push(value) })
  assertHorizontal(result)
  const content = region(result.nodes, 'auna-record-content')
  for (const text of ['V-001', sale.customer, '123456-7', 'Vendedor visible', 'A crédito', '2 partidas', 'Con devolución']) assert.ok(content.includes(text), text)
  const side = region(result.nodes, 'auna-record-side')
  assert.match(side, /Confirmada/)
  assert.match(side, /Total neto/)
  assert.match(side, /\$0\.00/)
  assert.match(side, /line-through[^>]*>\$25\.00/)
  assert.doesNotMatch(side, /Ver detalle de V-001/)
  const card = result.nodes.find(node => node.type === 'article' && node.props.className.includes('auna-record-card'))
  assert.equal(card.props.role, 'button')
  card.props.onClick({})
  assert.deepEqual(seen, [sale])
  assert.doesNotMatch(renderSales({ canViewDetail: false, canViewInvoice: false, canChangeStatus: false }).html, /Ver detalle|Ver factura|Más acciones/)
  assert.doesNotMatch(renderSales({ updatingSaleIds: new Set(['V-001']) }).html.match(/<article[\s\S]*?<\/article>/)[0], /<button/,'clickable cards never reintroduce action buttons; pagination stays outside')
})

test('merchandise cards keep supplier and terms left, payment and total right, and detail permission and route', () => {
  const paths = []
  const result = renderMerchandise({ navigate: path => paths.push(path) })
  assertHorizontal(result)
  const content = region(result.nodes, 'auna-record-content')
  for (const text of [merchandise.supplier.name, '2 productos', 'Crédito 30 días']) assert.ok(content.includes(text), text)
  const side = region(result.nodes, 'auna-record-side')
  assert.match(side, /Parcial/)
  assert.match(side, /\$25\.00/)
  assert.doesNotMatch(side, /Ver detalles/)
  const card = result.nodes.find(node => node.props.role === 'button' && node.props.className?.includes('auna-surface'))
  assert.equal(card.props.role, 'button')
  assert.ok(card.props.className.includes('auna-record-interactive'))
  card.props.onClick({})
  assert.deepEqual(paths, ['/mercancia/record-12345'])
  assert.doesNotMatch(renderMerchandise({ allowed: false }).html, /Ver detalles/)
})

test('transfer cards retain the full route and unit totals without filler images or nested controls', () => {
  const result = renderTransfers()
  assertHorizontal(result)
  const content = region(result.nodes, 'auna-record-content')
  for (const text of ['TR-001', transfer.fromBranch.name, transfer.toBranch.name, '1 productos', '7 unidades']) assert.ok(content.includes(text), text)
  const side = region(result.nodes, 'auna-record-side')
  assert.match(side, /En tránsito/)
  const button = result.nodes.find(node => node.type === 'button' && node.props?.className?.includes('auna-record-card'))
  assert.equal(typeof button.props.onClick, 'function')
  assert.doesNotMatch(renderToStaticMarkup(React.createElement('div', null, button.props.children)), /<button\b|<a\b|<img\b/)
})

test('commercial card loading and failure states retain feedback and retry', () => {
  assert.match(renderSales({ sales: [], isLoading: true }).html, /Cargando ventas/)
  assert.match(renderMerchandise({ state: { isLoading: true } }).html, /Cargando entradas/)
  assert.match(renderTransfers({ isLoading: true }).html, /Cargando traslados/)
  assert.match(renderMerchandise({ state: { isError: true } }).html, /No se pudieron cargar las entradas.*Reintentar/)
  assert.match(renderTransfers({ isError: true }).html, /No pudimos cargar los traslados.*Reintentar/)
})

test('merchandise and transfers send the measured card size and route selector changes to card pagination', () => {
  for (const module of ['merchandise', 'transfers']) {
    const reads = [], queries = [], sizes = []
    const pagination = { pageSize: 12, pageSizeOptions: [12, 24, 36, 48], containerRef() {}, setCardPageSize: value => sizes.push(value) }
    const mocks = { '@/hooks/useCardPagination': { useCardPagination: () => pagination } }
    let result
    if (module === 'merchandise') {
      mocks['../hooks/useIncomingMerchandise'] = { useIncomingMerchandise: params => { reads.push(params); return { data: { items: [merchandise], totalItems: 60, totalPages: 5 }, isLoading: false } } }
      result = renderMerchandise({ mocks })
      const select = result.nodes.find(node => node.type === 'select' && node.props.value === 12)
      assert.deepEqual(React.Children.toArray(select.props.children).map(node => node.props.value), [12, 24, 36, 48])
      select.props.onChange({ target: { value: '24' } })
    } else {
      mocks['@tanstack/react-query'] = { useQuery: options => { queries.push(options); return { data: options.queryKey[0] === 'transfers' ? { items: [transfer], totalItems: 60, totalPages: 5, page: 1, pageSize: 12 } : [] } }, useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }) }
      mocks['@/services/tenantService'] = { fetchTransfers: params => reads.push(params) }
      result = renderTransfers({}, mocks)
      const query = queries.find(options => options.queryKey[0] === 'transfers')
      assert.ok(query.queryKey.includes(12), 'Different page sizes need separate query cache entries')
      query.queryFn()
      result.nodes.find(node => node.props.value === '12' && node.props.onValueChange).props.onValueChange('24')
    }
    assert.equal(reads[0].pageSize, 12, module)
    assert.deepEqual(sizes, [24], module)
    assert.ok(result.nodes.some(node => node.type === 'section' && node.props.ref === pagination.containerRef), module)
  }
})

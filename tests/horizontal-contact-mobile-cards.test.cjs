const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const mutation = { isPending: false, mutateAsync() {} }
const api = { apiFetch() { throw new Error('No external operations in presentation checks') }, getApiBaseUrl: () => 'https://qa.example.test' }
function renderPage(file, mocks) {
  const nodes = [], navigations = []
  const Page = loadReportModule(file, {
    '@/services/api': api,
    './api': api,
    'react-router-dom': { useNavigate: () => url => navigations.push(url), useLocation: () => ({ state: null }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 20, viewMode: 'cards', setPage() {}, setPageSize() {}, setViewMode() {} }), useResetPageOnFilterChange() {} },
    '@tanstack/react-query': { useQuery: () => ({ data: [], isLoading: false }) },
    ...mocks,
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(Page))
  return { html, nodes, navigations }
}
const hasClass = (node, name) => node.props.className?.split(' ').includes(name)
const markup = node => renderToStaticMarkup(node)
function cardParts(result, compact = false) {
  const card = result.nodes.find(node => hasClass(node, 'auna-record-card'))
  assert.ok(card, 'Record must render as a horizontal card')
  assert.ok(hasClass(card, 'auna-surface'), 'Record retains the shared themed surface')
  const children = React.Children.toArray(card.props.children)
  const content = children.find(node => hasClass(node, 'auna-record-content'))
  const side = children.find(node => hasClass(node, 'auna-record-side'))
  assert.ok(content, 'All record details stay beside the media or side column')
  if (!compact) assert.ok(side, 'Status and total occupy the side column')
  return { card, children, content, side }
}
function mobileGrid(result, visibilityClass) {
  const wrapper = result.nodes.find(node => node.type === 'div' && hasClass(node, visibilityClass) && React.Children.toArray(node.props.children).some(child => hasClass(child, 'auna-record-grid')))
  assert.ok(wrapper, 'Mobile results retain their responsive visibility wrapper')
  assert.ok(!hasClass(wrapper, 'auna-record-grid'), 'Grid display must not override the responsive hiding class')
  const grid = React.Children.toArray(wrapper.props.children).find(node => hasClass(node, 'auna-record-grid'))
  assert.ok(hasClass(grid, 'auna-record-grid'), 'Horizontal cards live inside the visibility wrapper')
  return grid
}

test('mobile pagination measurement stays mounted for empty and failed order and return lists', () => {
  for (const isError of [false, true]) {
    const orders = renderPage('../orders/pages/OrdersManagement.tsx', {
      '@tanstack/react-query': { useQuery: () => ({ data: { items: [] }, isLoading: false, isError }) },
      '@/modules/quotes': { commercialDocSearchHint: () => '', isCommercialDocSearchReady: () => true },
    })
    const returns = renderPage('../returns/pages/ReturnsManagement.tsx', {
      '../hooks/useReturns': { useReturns: () => ({ data: { items: [] }, isLoading: false, isError }), useUpdateReturnStatus: () => mutation },
    })
    for (const result of [orders, returns]) {
      const measured = result.nodes.find(node => node.type === 'div' && typeof node.props.ref === 'function')
      assert.ok(measured, 'A stable mobile toolbar must still observe desktop width zero when results disappear')
      assert.ok(React.Children.toArray(measured.props.children).some(child => child.type?.name === 'CardPageSizeSelect'))
    }
  }
})

test('contacts and mobile-only lists query the measured page size and retain its selector', () => {
  for (const module of ['contacts', 'orders', 'returns']) {
    const reads = [], queries = [], sizes = []
    const pagination = { pageSize: 12, pageSizeOptions: [12, 24, 36, 48], containerRef() {}, setCardPageSize: value => sizes.push(value) }
    const mocks = { '@/hooks/useCardPagination': { useCardPagination: () => pagination } }
    let file
    if (module === 'contacts') {
      file = '../contacts/pages/SuppliersManagement.tsx'
      mocks['@/hooks/useSuppliers'] = { useSuppliers: params => { reads.push(params); return { data: { items: [{ id: 'contact', name: 'QA', party_type: 'CUSTOMER', status: 'active' }], totalItems: 60, totalPages: 5 } } } }
      mocks['@/hooks/useCategories'] = { useCategories: () => ({ data: [] }) }
      mocks['@/hooks/usePaymentTerms'] = { usePaymentTerms: () => ({ data: [] }) }
      mocks['@/hooks/useSupplier'] = { useSupplier: () => ({ data: null }) }
      mocks['@/hooks/useUpdateSupplier'] = { useUpdateSupplier: () => mutation }
    } else if (module === 'returns') {
      file = '../returns/pages/ReturnsManagement.tsx'
      mocks['../hooks/useReturns'] = { useReturns: params => { reads.push(params); return { data: { items: [] }, isLoading: false } }, useUpdateReturnStatus: () => mutation }
    } else {
      file = '../orders/pages/OrdersManagement.tsx'
      mocks['@tanstack/react-query'] = { useQuery: options => { queries.push(options); return { data: { items: [] }, isLoading: false } } }
      mocks['@/services/orderService'] = { fetchOrders: params => reads.push(params) }
      mocks['@/modules/quotes'] = { commercialDocSearchHint: () => '', isCommercialDocSearchReady: () => true }
    }
    const result = renderPage(file, mocks)
    if (module === 'orders') {
      const query = queries.find(options => options.queryKey[0] === 'orders')
      assert.ok(query.queryKey.includes(12))
      query.queryFn()
    }
    assert.equal(reads[0].pageSize, 12, module)
    result.nodes.find(node => node.props.value === '12' && node.props.onValueChange).props.onValueChange('24')
    assert.deepEqual(sizes, [24], module)
    assert.ok(result.nodes.some(node => node.props.ref === pagination.containerRef), module)
  }
})

test('contact cards keep every field beside their own photo, with fallback images and keyboard navigation', () => {
  const contacts = [
    { id: 'contact-photo', name: 'Proveedor con foto', party_type: 'SUPPLIER', status: 'active', imageUrl: '/images/provider-qa.jpg', contact: 'Responsable QA', phone: '5555-1234', email: 'un-correo-muy-largo-para-contacto@example.test', address: 'Dirección completa del proveedor QA', categoriesLabel: 'Bebidas y alimentos', category: 'Bebidas' },
    { id: 'contact-fallback', name: 'Cliente sin foto', party_type: 'CUSTOMER', status: 'inactive', imageUrl: null, contact: 'Cliente QA', phone: '5555-9999', email: 'cliente@example.test', address: 'Dirección cliente QA', category: 'Clientes' },
  ]
  const result = renderPage('../contacts/pages/SuppliersManagement.tsx', {
    '@/hooks/useSuppliers': { useSuppliers: () => ({ data: { items: contacts, totalItems: 2, totalPages: 1 }, isLoading: false }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [] }) },
    '@/hooks/usePaymentTerms': { usePaymentTerms: () => ({ data: [] }) },
    '@/hooks/useSupplier': { useSupplier: () => ({ data: null }) },
    '@/hooks/useUpdateSupplier': { useUpdateSupplier: () => mutation },
  })
  assert.ok(result.nodes.some(node => hasClass(node, 'auna-record-grid')))
  const { card, children, content } = cardParts(result, true)
  assert.equal(children.length, 2)
  assert.ok(hasClass(children[0], 'auna-record-media'), 'Photo is the first full-card column')
  assert.match(markup(children[0]), /src="\/images\/provider-qa.jpg"/)
  for (const value of ['Proveedor con foto', 'Proveedor', 'Bebidas y alimentos', 'Responsable QA', '5555-1234', 'un-correo-muy-largo-para-contacto@example.test', 'Dirección completa del proveedor QA']) assert.ok(markup(content).includes(value), value)
  assert.doesNotMatch(markup(content), /\btruncate\b/)
  assert.match(markup(React.Children.toArray(content.props.children)[0]), /Activo/)
  assert.match(result.html, /contact-no-image.svg/)
  assert.doesNotMatch(result.html, /animate-bounce-in/)
  assert.doesNotMatch(markup(React.createElement(card.type, card.props)), /<button\b/)
  assert.equal(card.props.role, 'button')
  assert.equal(card.props.tabIndex, 0)
  for (const key of ['Enter', ' ']) {
    let prevented = false
    card.props.onKeyDown({ key, preventDefault() { prevented = true } })
    assert.equal(prevented, true)
  }
  card.props.onClick({})
  assert.deepEqual(result.navigations, ['/contactos/contact-photo', '/contactos/contact-photo', '/contactos/contact-photo'])
})

test('mobile order cards use content and status columns without invented media and keep native navigation', () => {
  const order = { id: 'order-qa', reference: 'PED-QA', doc_type: 'ORDER', status: 'CONFIRMED', customer: 'Cliente del pedido QA', is_final_consumer: false, sales_channel: 'STORE', total: 123.5, created_at: '2026-10-09T12:00:00Z', updated_at: '2026-10-09T12:00:00Z', lines: [] }
  const result = renderPage('../orders/pages/OrdersManagement.tsx', {
    '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'orders' ? { items: [order], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } : { items: [] }, isLoading: false }) },
    '@/modules/quotes': { commercialDocSearchHint: () => '', isCommercialDocSearchReady: () => true },
  })
  mobileGrid(result, 'min-[650px]:hidden')
  const { card, children, content, side } = cardParts(result)
  assert.equal(card.type, 'button')
  assert.equal(card.props.type, 'button')
  assert.equal(children.length, 2)
  assert.match(markup(content), /PED-QA/)
  assert.match(markup(content), /Cliente del pedido QA/)
  assert.match(markup(content), /09.*oct.*2026/)
  assert.match(markup(side), /123\.50/)
  assert.match(markup(side), /En preparación/)
  assert.doesNotMatch(markup(side), /Ver detalle/)
  assert.doesNotMatch(markup(React.createElement(card.type, card.props)), /<img\b|auna-record-media/)
  assert.equal((markup(React.createElement(card.type, card.props)).match(/<button\b/g) ?? []).length, 1)
  card.props.onClick()
  assert.deepEqual(result.navigations, ['/pedidos/order-qa'])
  assert.match(result.html, /<table\b/)
  assert.match(result.html, /Estado de preparación/)
})

test('mobile return cards retain customer, date, status, amount and native navigation without media', () => {
  const record = { id: 'return-qa', sale_id: 'sale-qa', return_date: '2026-10-09T12:00:00Z', type: 'REFUND', reason: 'Producto dañado', total_refund: 25, status: { id: 1, name: 'Pendiente' }, sale: { reference: 'VTA-QA', customer: 'Cliente devolución QA' }, return_items: [] }
  const result = renderPage('../returns/pages/ReturnsManagement.tsx', {
    '../hooks/useReturns': { useReturns: () => ({ data: { items: [record], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }, isLoading: false }), useUpdateReturnStatus: () => mutation },
  })
  mobileGrid(result, 'md:hidden')
  const { card, children, content, side } = cardParts(result)
  assert.equal(card.type, 'button')
  assert.equal(card.props.type, 'button')
  assert.equal(children.length, 2)
  assert.match(markup(content), /VTA-QA/)
  assert.match(markup(content), /Cliente devolución QA/)
  assert.match(markup(content), /2026/)
  assert.match(markup(side), /Pendiente/)
  assert.match(markup(side), /25\.00/)
  assert.doesNotMatch(markup(React.createElement(card.type, card.props)), /<img\b|auna-record-media/)
  assert.equal((markup(React.createElement(card.type, card.props)).match(/<button\b/g) ?? []).length, 1)
  card.props.onClick()
  assert.deepEqual(result.navigations, ['/devoluciones/return-qa'])
  assert.match(result.html, /<table\b/)
  assert.match(result.html, /Producto dañado/)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const contact = { id: 'contact-qa', name: 'Empresa de prueba', party_type: 'SUPPLIER', taxId: '1234567-8', contact: 'Persona de contacto', phone: '5555-1234', email: 'compras@example.test', address: 'Dirección completa de prueba', categoriesLabel: 'Bebidas', status: 'active' }
function render({ view = 'cards', state = {}, permission = () => true, error = false, items = [contact] } = {}) {
  const nodes = [], queries = [], navigations = [], changes = [], resets = [], refetches = [], uiOptions = []
  let index = 0
  const Page = loadReportModule('../contacts/pages/SuppliersManagement.tsx', {
    react: { ...React, useState(initial) { const i = index++; const [value] = React.useState(Object.hasOwn(state, i) ? state[i] : initial); return [value, next => changes.push([i, next])] } },
    'react-router-dom': { useNavigate: () => url => navigations.push(url), useLocation: () => ({ state: null }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: permission }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: (key, options) => { uiOptions.push(options); return { page: 1, pageSize: 10, viewMode: view, setPage: value => resets.push(value), setPageSize() {}, setViewMode() {} } }, useResetPageOnFilterChange() {} },
    '@/hooks/useCardPagination': { useCardPagination: () => ({ pageSize: 12, pageSizeOptions: [12, 24, 36, 48], containerRef() {}, setCardPageSize() {} }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [{ id: 4, name: 'Bebidas' }] }) },
    '@/hooks/usePaymentTerms': { usePaymentTerms: () => ({ data: [] }) },
    '@/hooks/useSupplier': { useSupplier: () => ({ data: null }) },
    '@/hooks/useUpdateSupplier': { useUpdateSupplier: () => ({ mutateAsync() {} }) },
    '@/hooks/useSuppliers': { useSuppliers: params => { queries.push(params); return { data: { items, page: 1, totalItems: items.length, totalPages: 1, nextPage: null, prevPage: null, summary: { total: items.length, active: items.length, inactive: 0 } }, isError: error, refetch: () => refetches.push(true) } } },
    '@/services/api': { apiFetch() { throw new Error('No external writes in list checks') } },
    './api': { apiFetch() { throw new Error('No external writes in list checks') } },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Page)), nodes, queries, navigations, changes, resets, refetches, uiOptions }
}
const hasClass = (node, name) => node.props.className?.split(' ').includes(name)

test('compact contacts place status beside name without a third column or action buttons', () => {
  const result = render()
  const card = result.nodes.find(node => hasClass(node, 'auna-record-card'))
  const children = React.Children.toArray(card.props.children)
  assert.equal(children.length, 2)
  assert.ok(hasClass(children[0], 'auna-record-media'))
  const content = children[1]
  const header = React.Children.toArray(content.props.children)[0]
  const html = renderToStaticMarkup(header)
  assert.match(html, /Empresa de prueba/)
  assert.match(html, /Activo/)
  for (const value of [contact.taxId, contact.contact, contact.phone, contact.email, contact.address]) assert.ok(result.html.includes(value))
  assert.match(result.html, /contact-no-image.svg/)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(card.type, card.props)), /<button|truncate|line-clamp/)
  card.props.onClick({})
  for (const key of ['Enter', ' ']) card.props.onKeyDown({ key, preventDefault() {} })
  assert.deepEqual(result.navigations, Array(3).fill('/contactos/contact-qa'))
})

test('table offers NIT and permission-gated detail/edit actions using the shared detail editor', () => {
  const result = render({ view: 'table' })
  assert.match(result.html, /<table/)
  assert.match(result.html, /NIT/)
  assert.match(result.html, /1234567-8/)
  result.nodes.find(node => node.props['aria-label'] === 'Ver Empresa de prueba').props.onClick()
  result.nodes.find(node => node.props['aria-label'] === 'Editar Empresa de prueba').props.onClick()
  assert.deepEqual(result.navigations, ['/contactos/contact-qa', '/contactos/contact-qa?editar=1'])
  assert.doesNotMatch(render({ view: 'table', permission: value => value.endsWith('.view') }).html, /aria-label="Editar |Nuevo contacto|Importar/)
})

test('type, category and status filters go to the server, including inactive zero', () => {
  const result = render({ state: { 0: '5555', 1: 'SUPPLIER', 2: '0', 3: '4' } })
  assert.equal(result.queries[0].search, '5555')
  assert.equal(result.queries[0].party_type, 'SUPPLIER')
  assert.equal(result.queries[0].estado, 0)
  assert.equal(result.queries[0].category_id, '4')
  assert.match(result.html, /Filtros aplicados/)
  result.nodes.find(node => node.props.onClear).props.onClear()
  assert.ok(result.changes.some(([i, value]) => i === 2 && value === 'all'))
  assert.ok(result.changes.some(([i, value]) => i === 3 && value === 'all'))
})

test('pagination stays outside table, shows counts and preserves responsive card sizes', () => {
  const result = render({ view: 'table' })
  const table = result.nodes.find(node => node.type === 'table')
  assert.equal(result.uiOptions[0].defaultPageSize, 50)
  assert.ok(table)
  const pagination = result.nodes.find(node => node.type?.name === 'Pagination')
  assert.equal(pagination.props.totalItems, 1)
  assert.equal(pagination.props.count, 1)
  assert.equal(pagination.props.itemLabel, 'contactos')
  assert.ok(result.nodes.some(node => hasClass(node, 'auna-pagination-outside')))
  assert.equal(render().queries[0].pageSize, 12)
})

test('failure offers retry and empty state preserves toolbar and create permission', () => {
  const result = render({ error: true })
  result.nodes.find(node => node.props.onClick && node.props.children === 'Reintentar').props.onClick()
  assert.deepEqual(result.refetches, [true])
  const empty = render({ items: [] })
  assert.match(empty.html, /No hay contactos/)
  assert.match(empty.html, /Buscar contactos/)
  assert.match(empty.html, /Nuevo contacto/)
})

test('supplier query serializes inactive state rather than omitting zero', async () => {
  const requests = []
  const { fetchSuppliers } = loadReportModule('../../services/supplierService.ts', {
    './api': { apiFetch: async url => { requests.push(url); return { items: [] } } },
  })
  await fetchSuppliers({ estado: 0 })
  assert.equal(new URL(requests[0], 'https://qa.example.test').searchParams.get('estado'), '0')
})

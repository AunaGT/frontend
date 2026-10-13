const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')

const contact = { id: 'qa-contact', party_type: 'SUPPLIER', entityKind: 'ORGANIZATION', name: 'Empresa QA', contact: 'Ana QA', phone: '5555-0101', email: 'qa@example.test', address: 'Dirección QA', taxId: '123456-7', category: 'Bebidas', categories: [{ id: 1, name: 'Bebidas' }, { id: 2, name: 'Alimentos' }], categoriesLabel: 'Bebidas, Alimentos', products: 12, totalPurchases: 125, lastOrder: '9 oct 2026', status: 'active', estado: 1, paymentTerms: '30 días', paymentTermsList: [{ id: 3, name: '30 días', isDefault: true, netDays: 30 }], imageUrl: '/qa-contact.png', productsList: Array.from({ length: 12 }, (_, i) => ({ id: `product-${i}`, name: `Producto ${i + 1}`, stock: 5, price: 10 })) }
const entry = { id: 'qa-entry', date: '2026-10-09', registeredBy: { name: 'Operador QA' }, itemsCount: 2, totalValue: 125 }
const sale = { id: 'qa-sale', reference: 'V-QA-001', date: '2026-10-09', total: 125, adjusted_total: 100, items: 2, status: { name: 'Completada' } }

function renderContact({ customer = false, allowed = true, history = true, edit = false, pane = 'detalles', states = {}, updateError = null, permissions = null } = {}) {
  let index = 0
  const nodes = [], changes = [], queries = [], requests = [], notices = [], searches = [], navigations = [], effects = []
  const raw = { ...contact, party_type: customer ? 'CUSTOMER' : 'SUPPLIER', credit_limit: customer ? 500 : null }
  const Page = loadReportModule('../contacts/components/SupplierDetailPage.tsx', {
    react: { ...React, useEffect: (run, deps) => effects.push({ run, deps }), useState: initial => {
      const i = index++
      const values = { 16: pane, 17: 'Empresa QA', 18: 'Ana QA', 19: '5555-0101', 20: 'qa@example.test', 21: 'Dirección QA', 23: ['3'], 24: '3', 27: '123456-7', 28: '500', ...states }
      const [value, setValue] = React.useState(Object.hasOwn(values, i) ? values[i] : initial)
      return [value, next => { const updated = typeof next === 'function' ? next(value) : next; changes.push({ index: i, value: updated }); setValue(updated) }]
    } },
    'react-router-dom': { useParams: () => ({ id: 'qa-contact' }), useNavigate: () => path => navigations.push(path), useSearchParams: () => [new URLSearchParams(`origen=lista${edit ? '&editar=1' : ''}`), (next, options) => searches.push({ value: String(typeof next === 'function' ? next(new URLSearchParams(`origen=lista${edit ? '&editar=1' : ''}`)) : next), options })] },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/hooks/useSupplier': { useSupplier: () => ({ data: raw, isLoading: false, refetch: async () => requests.push('refetch') }) },
    '@/hooks/useCustomerSales': { useCustomerSales: (id, options) => { queries.push({ type: 'sales', id, ...options }); return { data: { items: [sale], totalItems: 24, totalPages: 3, customerPurchaseSummary: { totalPurchases: 2400, lastSaleDate: '2026-10-09' } } } } },
    '@/modules/merchandise': { useIncomingMerchandise: options => { queries.push({ type: 'entries', ...options }); return { data: { items: [entry], totalItems: 24, totalPages: 3 } } }, useIncomingMerchandiseById: () => ({ data: null }), fetchIncomingMerchandise() { throw new Error('Unexpected export fetch') } },
    '@/modules/sales': { normalizeRawSale: raw => raw, SaleDetailDialog: () => null },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: permission => permissions ? permissions.includes(permission) : permission.endsWith('.edit') || permission.endsWith('.delete') ? allowed : history }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => notices.push(value) }) },
    '@/hooks/useUpdateSupplier': { useUpdateSupplier: () => ({ mutateAsync: async value => { requests.push(value); if (updateError) throw updateError }, isPending: false }) },
    '@/hooks/useDeleteSupplier': { useDeleteSupplier: () => ({ mutateAsync: async id => requests.push({ delete: id }), isPending: false }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [{ id: 1, name: 'Bebidas' }, { id: 2, name: 'Alimentos' }, { id: 3, name: 'Limpieza' }] }) },
    '@/hooks/usePaymentTerms': { usePaymentTerms: () => ({ data: [{ id: 3, name: '30 días', net_days: 30 }] }) },
    '@/services/supplierService': { adaptApiSupplier: value => value, replaceSupplierPriceRules: async (id, rules) => requests.push({ id, rules }) },
    './generateSupplierPDF': { generateSupplierPDF() { throw new Error('Unexpected PDF export') } },
    '@/utils/pdfBranding': { resolvePdfLogoDataUrl: async () => null },
    '@/services/saleService': { fetchSalesByCustomerContact() { throw new Error('Unexpected sales export') } },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Page)), nodes, changes, queries, requests, notices, searches, navigations, effects }
}

test('supplier puts identity and summary before navigation, with grouped data and bounded products', () => {
  const { html } = renderContact()
  assert.match(html, /src="\/qa-contact.png"/)
  assert.match(html, /href="mailto:qa@example.test"/)
  assert.match(html, /href="tel:5555-0101"/)
  assert.ok(html.indexOf('Resumen del contacto') < html.indexOf('Información del contacto'))
  for (const label of ['Identidad y contacto', 'Condiciones comerciales', 'Actividad reciente', 'Empresa QA', 'Ana QA', 'Dirección QA', '123456-7', '30 días']) assert.ok(html.includes(label), label)
  assert.match(html, /role="region" aria-label="Productos del proveedor" tabindex="0"/)
  assert.match(html, /Producto 10/)
  assert.doesNotMatch(html, /Producto 11/)
  assertPaginationOutside(html)
})

test('customer summary uses full-history totals and retains customer credit and pricing controls', () => {
  const { html, queries } = renderContact({ customer: true })
  assert.match(html, /2,400\.00/)
  assert.match(html, /Límite de crédito/)
  assert.match(html, /Precios por canal/)
  assert.doesNotMatch(html, /Productos que suministra|Entradas de mercancía/)
  assert.deepEqual(queries.map(q => [q.type, q.enabled]), [['entries', false], ['sales', true]])
})

test('read-only URL never grants editing or history access', () => {
  const { html, queries } = renderContact({ customer: true, allowed: false, history: false, edit: true })
  assert.doesNotMatch(html, /Guardar cambios|Cancelar cambios|Precios por canal|Historial de compras|Eliminar/)
  assert.ok(queries.every(query => query.enabled === false))
})

test('edit URL opens grouped fields and saving preserves payment terms and photo upload payload', async () => {
  const result = renderContact({ customer: true, edit: true, states: { 30: { name: 'foto.png' } } })
  assert.match(result.html, /Guardar cambios/)
  assert.match(result.html, /Identidad y contacto/)
  result.nodes.find(n => n.props?.children === 'Guardar cambios').props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(result.requests[0], { id: 'qa-contact', image: { name: 'foto.png' }, payload: { entity_kind: 'ORGANIZATION', name: 'Empresa QA', contact: 'Ana QA', phone: '5555-0101', email: 'qa@example.test', address: 'Dirección QA', tax_id: '123456-7', credit_limit: '500', category_ids: undefined, payment_terms: [{ payment_term_id: 3, is_default: true, sort_order: 0 }], estado: 1 } })
  assert.equal(result.searches.at(-1).value, 'origen=lista')
})

test('missing default terms block save and image failures retain edit state and selected photo', async () => {
  const invalid = renderContact({ edit: true, states: { 23: [], 24: undefined } })
  invalid.nodes.find(n => n.props?.children === 'Guardar cambios').props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(invalid.requests.length, 0)
  assert.equal(invalid.notices[0].title, 'Términos de pago')
  const partial = renderContact({ edit: true, updateError: Object.assign(new Error('Foto fallida'), { imageUploadFailed: true }) })
  partial.nodes.find(n => n.props?.children === 'Guardar cambios').props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(partial.notices[0].title, 'Datos guardados; foto pendiente')
  assert.equal(partial.searches.length, 0)
})

test('history tables remain scoped and expose bounded keyboard scroll with external pagination', () => {
  for (const [customer, pane, label] of [[false, 'entradas', 'Entradas del proveedor'], [true, 'compras', 'Compras del cliente']]) {
    const { html, queries } = renderContact({ customer, pane })
    assert.match(html, new RegExp(`role="region" aria-label="${label}" tabindex="0"`))
    assertPaginationOutside(html)
    const query = queries.find(q => q.enabled)
    assert.equal(query.supplier_id ?? query.id, 'qa-contact')
    assert.equal(query.page, 1)
    assert.equal(query.pageSize, 10)
  }
})

test('overview labels a later history page honestly and keeps supplied products paginated', () => {
  const { html } = renderContact({ states: { 0: 2, 32: 2 } })
  assert.match(html, /Actividad · página 2/)
  assert.doesNotMatch(html, /Actividad reciente/)
  assert.match(html, /Producto 11/)
  assert.doesNotMatch(html, />Producto 1</)
})

test('edit and cancel synchronize the URL, restore all fields and clear photo without saving', () => {
  const readonly = renderContact()
  readonly.nodes.find(n => n.props?.children?.includes?.('Editar')).props.onClick()
  assert.equal(readonly.searches[0].value, 'origen=lista&editar=1')
  const edited = renderContact({ customer: true, edit: true, states: { 27: 'OTHER', 28: '99', 30: { name: 'foto.png' } } })
  edited.nodes.find(n => n.props?.children === 'Cancelar cambios').props.onClick()
  assert.equal(edited.searches[0].value, 'origen=lista')
  assert.ok(edited.changes.some(change => change.index === 27 && change.value === '123456-7'))
  assert.ok(edited.changes.some(change => change.index === 28 && change.value === '500'))
  assert.ok(edited.changes.some(change => change.index === 30 && change.value === null))
  assert.equal(edited.requests.length, 0)
})

test('photo selection retains the shared upload limits and reject feedback', () => {
  const result = renderContact({ edit: true })
  const upload = result.nodes.find(n => n.props?.fileLabel === 'foto')
  assert.equal(upload.props.maxSizeBytes, 5 * 1024 * 1024)
  assert.equal(upload.props.accept, 'image/jpeg,image/png,image/webp')
  upload.props.onFileSelect({ name: 'photo.webp' })
  assert.deepEqual(result.changes.at(-1), { index: 30, value: { name: 'photo.webp' } })
  upload.props.onReject('Archivo demasiado grande')
  assert.equal(result.notices.at(-1).description, 'Archivo demasiado grande')
})

test('history activation retains detail and invoice permission behavior for keyboard users', () => {
  const entries = renderContact({ pane: 'entradas' })
  entries.nodes.find(n => n.type === 'tr' && n.props?.role === 'button').props.onKeyDown({ key: 'Enter', preventDefault() {} })
  assert.ok(entries.changes.some(change => change.index === 4 && change.value === 'qa-entry'))
  const customer = renderContact({ customer: true, pane: 'compras', permissions: ['sales.view', 'sales.view_invoice'] })
  customer.nodes.find(n => n.type === 'tr' && n.props?.role === 'button').props.onKeyDown({ key: ' ', preventDefault() {} })
  assert.deepEqual(customer.navigations, ['/ventas/V-QA-001/factura'])
  const limited = renderContact({ customer: true, pane: 'compras', permissions: ['sales.view'] })
  assert.doesNotMatch(limited.html, /<tr[^>]+role="button"/)
})

test('download and deletion retain their confirmation boundaries', () => {
  const result = renderContact()
  result.nodes.find(n => n.props?.children?.includes?.('Descargar PDF')).props.onClick()
  assert.deepEqual(result.changes.at(-1), { index: 8, value: true })
  result.nodes.find(n => n.props?.children?.includes?.('Eliminar')).props.onClick()
  assert.deepEqual(result.changes.at(-1), { index: 14, value: true })
  assert.equal(result.requests.length, 0)
})

test('editing from a history tab opens the detail form instead of leaving it hidden', () => {
  const result = renderContact({ pane: 'entradas' })
  result.nodes.find(n => n.props?.children?.includes?.('Editar')).props.onClick()
  assert.ok(result.changes.some(change => change.index === 16 && change.value === 'detalles'))
  assert.equal(result.searches.at(-1).value, 'origen=lista&editar=1')
})

test('editing never submits blank required fields or an invalid email', async () => {
  for (const [index, value] of [[17, '  '], [18, ''], [19, ' '], [20, ''], [20, 'bad-email'], [21, '']]) {
    const result = renderContact({ edit: true, states: { [index]: value } })
    await result.nodes.find(n => n.props?.children === 'Guardar cambios').props.onClick()
    assert.equal(result.requests.length, 0, `Invalid field ${index}: ${value}`)
    assert.equal(result.notices.at(-1).variant, 'destructive')
    assert.equal(result.searches.length, 0)
  }
})

test('individual contacts use their own name and save normalized required values', async () => {
  const result = renderContact({ edit: true, states: { 17: '  Ana QA  ', 18: '', 19: '  5555-0101  ', 20: ' qa@example.test ', 21: ' Dirección QA ', 29: 'PERSON' } })
  await result.nodes.find(n => n.props?.children === 'Guardar cambios').props.onClick()
  const payload = result.requests[0].payload
  assert.deepEqual([payload.name, payload.contact, payload.phone, payload.email, payload.address], ['Ana QA', 'Ana QA', '5555-0101', 'qa@example.test', 'Dirección QA'])
})

test('supplier categories hydrate and cancel from the saved associations, allowing explicit clearing', async () => {
  const initial = renderContact({ edit: true })
  initial.effects.find(effect => effect.deps?.[0]?.id === 'qa-contact' && effect.deps[1] === null).run()
  const categories = initial.changes.find(change => change.index === 22).value
  assert.deepEqual(categories, ['1', '2'])
  const edit = renderContact({ edit: true, states: { 22: categories } })
  edit.nodes.find(n => n.props?.value === 'Limpieza').props.onSelect()
  assert.deepEqual(edit.changes.at(-1), { index: 22, value: ['1', '2', '3'] })
  edit.nodes.find(n => n.props?.children === 'Cancelar cambios').props.onClick()
  assert.deepEqual(edit.changes.filter(change => change.index === 22).at(-1).value, ['1', '2'])
  const cleared = renderContact({ edit: true, states: { 22: [] } })
  await cleared.nodes.find(n => n.props?.children === 'Guardar cambios').props.onClick()
  assert.deepEqual(cleared.requests[0].payload.category_ids, [])
})

test('a failed photo refreshes saved contact data while retaining the selected photo for retry', async () => {
  const result = renderContact({ edit: true, states: { 30: { name: 'retry.webp' } }, updateError: Object.assign(new Error('Foto fallida'), { imageUploadFailed: true }) })
  await result.nodes.find(n => n.props?.children === 'Guardar cambios').props.onClick()
  assert.deepEqual(result.requests.map(request => typeof request === 'string' ? request : request.id), ['qa-contact', 'refetch'])
  assert.equal(result.requests[0].image.name, 'retry.webp')
  assert.ok(!result.changes.some(change => change.index === 30 || change.index === 15))
  assert.equal(result.searches.length, 0)
  assert.equal(result.notices.at(-1).title, 'Datos guardados; foto pendiente')
})

test('editing keeps save and cancel in the contact header rather than below the photo uploader', () => {
  const result = renderContact({ edit: true })
  const header = result.nodes.find(node => node.type === 'header')
  const html = renderToStaticMarkup(React.createElement(header.type, header.props))
  assert.match(html, /Guardar cambios/)
  assert.match(html, /Cancelar cambios/)
  assert.equal((result.html.match(/>Guardar cambios</g) ?? []).length, 1)
  assert.doesNotMatch(renderContact().html, /Guardar cambios|Cancelar cambios/)
})

test('photo editing is collapsed until requested but keeps a pending file visible', () => {
  const initial = renderContact({ edit: true })
  const photo = initial.nodes.find(node => node.type === 'details')
  assert.ok(photo, 'The optional uploader must not consume a full row above the form')
  assert.ok(!photo.props.open)
  assert.match(renderToStaticMarkup(React.createElement(photo.type, photo.props)), /Cambiar foto/)
  const pending = renderContact({ edit: true, states: { 30: { name: 'pending.webp' } } })
  assert.equal(pending.nodes.find(node => node.type === 'details').props.open, true)
  assert.match(pending.html, /pending.webp/)
})

test('overview groups core data before operational content in two independent reading columns', () => {
  for (const customer of [false, true]) {
    const result = renderContact({ customer })
    const columns = result.nodes.filter(node => node.props.className?.split(' ').includes('contact-detail-column'))
    assert.equal(columns.length, 2)
    const first = renderToStaticMarkup(React.createElement(columns[0].type, columns[0].props))
    const second = renderToStaticMarkup(React.createElement(columns[1].type, columns[1].props))
    assert.match(first, /Identidad y contacto/)
    assert.match(first, /Condiciones comerciales/)
    assert.doesNotMatch(first, /Productos que suministra|Actividad reciente|Precios por canal/)
    assert.match(second, /Actividad reciente/)
    assert.match(second, customer ? /Precios por canal/ : /Productos que suministra/)
    assert.ok(result.html.indexOf('contact-commercial-heading') < result.html.indexOf(customer ? 'contact-activity-heading' : 'contact-products-heading'), 'Mobile reading order keeps contact and commercial information before records')
    if (!customer) assertPaginationOutside(result.html)
  }
})

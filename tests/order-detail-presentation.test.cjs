const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')

test('pending commercial quantity is exact for fractional services and clamps fulfilled balances', () => {
  const { pendingOrderLineQty } = loadReportModule('../../services/orderService.ts', { './api': {} })
  assert.equal(pendingOrderLineQty({ qty: '0.3', qty_fulfilled: '0.2' }), 0.1)
  assert.equal(pendingOrderLineQty({ qty: '1.25', qty_fulfilled: '1.5' }), 0)
})

const order = {
  id: 'qa-order', reference: 'P-QA-001', doc_type: 'ORDER', status: 'CONFIRMED', fulfillment_mode: 'LEGACY', branch_id: 'qa-branch', branch: { id: 'qa-branch', name: 'Principal', code: 'QA' },
  customer: 'Cliente histórico', customer_nit: '123456-7', is_final_consumer: false, customer_contact_id: 'qa-contact',
  customerContact: { id: 'qa-contact', name: 'Cliente actual', tax_id: '765432-1', contact: 'Responsable QA', email: 'qa@example.test', phone: '5555-0101', address: 'Dirección QA' },
  created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-08T12:00:00Z', createdBy: { id: 'qa-user', name: 'Usuario QA' },
  payment_condition: 'CREDIT', credit_days: 30, sales_channel: 'DIRECT', subtotal: '120.00', discount_total: '0.00', total: '120.00', notes: 'Entregar en recepción',
  delivery_carrier: 'Transportista QA', delivery_tracking_number: 'TRACK-QA', delivery_address: 'Dirección de entrega', delivery_dispatched_at: null, delivery_estimated_at: null,
  documentSales: [{ id: 'qa-link', sale: { id: 'qa-sale', reference: 'V-QA-001', total: '40.00', adjusted_total: '40.00', payment_status: 'PARTIAL', paymentEntries: [{ amount: '10.00' }], status: { name: 'Completada' } } }],
  lines: Array.from({ length: 12 }, (_, i) => ({ id: `qa-line-${i + 1}`, product_id: `qa-product-${i + 1}`, product: { id: `qa-product-${i + 1}`, name: `Artículo QA ${i + 1}`, barcode: `CODE-${i + 1}`, stock: 20 }, qty: 1, qty_fulfilled: 0, qty_invoiced: 0, unit_price: '10.00', line_total: '10.00' })),
  deliveries: [], stock_reservations: [],
}

function renderOrder({ data = order, permissions = ['orders.manage', 'sales.create', 'contacts.clients.view'], contactsEnabled = true, photoError = false, photo = '/qa-contact.png', page = 1, loading = false, saleQtys = {} } = {}) {
  let stateIndex = 0
  const nodes = [], changes = [], queries = [], reads = [], navigations = [], mutations = [], mutationOptions = [], requests = []
  const Page = loadReportModule('../orders/pages/OrderDetailPage.tsx', {
    react: { ...React, useState: initial => {
      const i = stateIndex++
      const [value, setValue] = React.useState(i === 6 ? page : i === 3 ? saleQtys : initial)
      return [value, next => { changes.push({ index: i, value: typeof next === 'function' ? next(value) : next }); setValue(next) }]
    } },
    'react-router-dom': { useParams: () => ({ id: 'qa-order' }), useNavigate: () => target => navigations.push(target) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company' }, branches: [{ id: 'qa-branch', name: 'Principal' }] }) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'qa-user', role: { name: 'admin' } } }) },
    '@/context/useModules': { useModules: () => ({ isEnabled: code => code !== 'contacts' || contactsEnabled }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: code => permissions.includes(code) }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ companyName: 'Empresa QA', companyLogoUrl: null, currencyCode: 'GTQ', locale: 'es-GT' }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [{ id: 1, name: 'Efectivo', is_credit: false }] }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/api': { apiFetch() { throw new Error('No real order mutations or queries') } },
    './api': { apiFetch(url,options) {requests.push({url,options});return Promise.resolve({})} },
    '@/modules/sales/checkout/public':{useCheckoutFlow:()=>({pending:false,attempt:null,error:null,blocked:false,submit:async(kind,payload,orderId)=>requests.push({checkoutKind:kind,orderId,options:{body:JSON.stringify(payload)}}),reconcile(){}}),CheckoutRecoveryNotice:()=>null},
    '@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn()})},
    '@/services/supplierService': { fetchSupplierById: async id => { reads.push(id); return { id, image_url: photo } } },
    '@/services/cashSessionsService': { listCashRegisters() { throw new Error('No real register queries') } },
    '../documents/generateOrderPDF': { generateOrderPDF() { throw new Error('No real PDF side effects') } },
    '@tanstack/react-query': {
      useQueryClient: () => ({ invalidateQueries() {}, setQueryData() {} }),
      useQuery: options => {
        queries.push(options)
        if (options.queryKey[0] === 'order') return { data, isLoading: loading, isFetching: false, isError: false }
        if (options.queryKey[0] === 'order-contact-photo') return { data: { id: 'qa-contact', image_url: photo }, isError: photoError }
        return { data: [{ id: 'qa-register', name: 'Caja QA', open_session: { opened_by_id: 'qa-user' } }], isLoading: false }
      },
      useMutation: options => {mutationOptions.push(options);return { isPending: false, mutate: value => mutations.push({ options, value }) }},
    },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Page)), nodes, changes, queries, reads, navigations, mutations,mutationOptions,requests }
}

test('private order groups overview and products in the main column, administrative information alongside', () => {
  const { html } = renderOrder()
  assert.match(html, /order-detail-layout/)
  assert.match(html, /order-detail-main/)
  assert.match(html, /order-detail-sidebar/)
  assert.ok(html.indexOf('Partidas (') < html.indexOf('Información del pedido'))
  for (const value of ['Cumplimiento del pedido', 'Transportista QA', 'TRACK-QA', 'V-QA-001', 'Entregar en recepción']) assert.ok(html.includes(value), value)
})
for(const example of [
  {qty:'0.123456',fulfilled:'0',base:'0.123456',baseFulfilled:'0',pending:'0.123456',factor:'1',label:'kg',decimals:6},
  {qty:'1',fulfilled:'0.428571',base:'7',baseFulfilled:'3',pending:'4',factor:'7',label:'unidades',decimals:0},
])test(`actual order detail renders mobile and desktop exact v2 pending ${example.pending} ${example.label}`,()=>{
  const data={...order,total:'10.00',subtotal:'10.00',lines:[{...order.lines[0],qty:example.qty,qty_fulfilled:example.fulfilled,base_qty:example.base,base_fulfilled:example.baseFulfilled,base_invoiced:'0',unit_metadata_version:2,unit_label:'caja original',unit_snapshot:{version:2,baseUnit:{id:'u',code:'UNIT',name:'Base',label:example.label,decimals:example.decimals},presentation:{id:'box',version:1,name:'Caja',label:'caja original',decimals:6},factor:example.factor,roundingDelta:'0'}}]}
  const {html}=renderOrder({data})
  const desktop=html.slice(html.indexOf('order-detail-products-scroll'),html.indexOf('order-detail-mobile-lines'))
  const mobile=html.slice(html.indexOf('order-detail-mobile-lines'),html.indexOf('Resumen de costos')>0?html.indexOf('Resumen de costos'):undefined)
  for(const layout of [desktop,mobile]){
    assert.ok(layout.includes(`${example.pending} ${example.label}`),layout)
    assert.ok(layout.includes(`${example.baseFulfilled} ${example.label}`),layout)
    assert.ok(layout.includes(`${example.qty} caja original`),layout)
  }
})
test('legacy order sale payload preserves fractional service strings',async()=>{
  const data={...order,lines:[{...order.lines[0],item_kind:'SERVICE',quantity_decimals:2,qty:'1',qty_fulfilled:'0.5',unit_price:'19.99',line_total:'19.99'}]}
  const {mutationOptions,requests}=renderOrder({data,saleQtys:{[data.lines[0].id]:'0.5'}})
  await mutationOptions[4].mutationFn()
  assert.equal(JSON.parse(requests[0].options.body).lines[0].qty,'0.5')
  assert.equal(requests[0].checkoutKind,'ORDER')
  assert.equal(requests[0].orderId,'qa-order')
})
test('mixed order uses snapshot names, units and line progress without summing goods and hours', () => {
  const data={...order,lines:[{...order.lines[0],item_kind:'SERVICE',item_name:'Asesoría original',unit_label:'Hora',quantity_decimals:3,qty:'0.125',qty_fulfilled:'0'}, {...order.lines[1],qty:10}]}
  const {html}=renderOrder({data})
  assert.match(html,/Asesoría original/);assert.match(html,/Hora/);assert.match(html,/0.125/);assert.doesNotMatch(html,/10.125/)
})

test('order uses one copy-link action and shared primary buttons without decorative overrides', () => {
  const { html } = renderOrder()
  assert.equal((html.match(/>Copiar enlace</g) || []).length, 1)
  assert.doesNotMatch(html, /Copiar enlace público/)
  assert.match(html, /auna-form-action-primary/)
  assert.doesNotMatch(html, /shadow-orange-500|dark:bg-\[#101f34\]/)
})

test('contact photo is scoped to company and permission, without changing historic identity', async () => {
  const result = renderOrder()
  const query = result.queries.find(q => q.queryKey[0] === 'order-contact-photo')
  assert.ok(query, 'The contact photo should use the existing customer query')
  assert.deepEqual(query.queryKey, ['order-contact-photo', 'qa-company', 'qa-contact'])
  assert.equal(query.enabled, true)
  await query.queryFn()
  assert.deepEqual(result.reads, ['qa-contact'])
  assert.match(result.html, /src="\/qa-contact.png"/)
  assert.match(result.html, /Cliente histórico/)
  assert.match(result.html, /123456-7/)
  result.nodes.find(n => n.props?.children?.includes?.('Ver contacto')).props.onClick()
  assert.deepEqual(result.navigations, ['/contactos/qa-contact'])
})

test('disabled contact access never uses a cached photo or exposes the contact navigation', () => {
  for (const options of [{ permissions: ['orders.manage', 'sales.create'] }, { contactsEnabled: false }]) {
    const { html, queries } = renderOrder(options)
    assert.equal(queries.find(q => q.queryKey[0] === 'order-contact-photo')?.enabled, false)
    assert.doesNotMatch(html, /\/qa-contact.png|Ver contacto/)
    assert.match(html, /contact-no-image.svg/)
  }
})

test('missing or failed photo uses the shared placeholder without blocking order details', () => {
  for (const options of [{ photo: null }, { photoError: true }, { data: { ...order, customerContact: null, customer_contact_id: null } }]) {
    const { html } = renderOrder(options)
    assert.match(html, /contact-no-image.svg/)
    assert.match(html, /Artículo QA 1/)
  }
})

test('product pagination remains outside the surface and displays only its real page', () => {
  const first = renderOrder()
  assert.match(first.html, /CODE-10/)
  assert.doesNotMatch(first.html, /CODE-11/)
  assertPaginationOutside(first.html)
  first.nodes.find(n => n.type?.name === 'Pagination').props.onPageChange(2)
  assert.deepEqual(first.changes.at(-1), { index: 6, value: 2 })
  const second = renderOrder({ page: 2 })
  assert.match(second.html, /CODE-11/)
  assert.doesNotMatch(second.html, /CODE-10/)
})

test('monetary and editing actions remain permission-protected and separate delivery operations remain available', () => {
  const readonly = renderOrder({ permissions: [] })
  assert.doesNotMatch(readonly.html, /Registrar venta|Abrir en POS|>Editar</)
  const separate = renderOrder({ data: { ...order, fulfillment_mode: 'SEPARATE', lines: order.lines.map(line => ({ ...line, qty_fulfilled: 1 })) } })
  assert.match(separate.html, /Entregas registradas/)
  assert.match(separate.html, /Registrar entrega|Registrar venta/)
})

test('loading order retains the same bounded width and responsive gutters', () => {
  assert.match(renderOrder({ data: undefined, loading: true }).html, /max-w-\[1560px\][^\"]*p-4 sm:p-8/)
})

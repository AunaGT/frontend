const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const runtime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const root = path.resolve(__dirname, '../src')
const sale = { id: 'sale-1', reference: 'V-001', date: '2026-10-08T12:00:00Z', customer: 'Cliente QA', customerNit: '123456-7', isFinalConsumer: false, createdByName: 'Ana QA', status: 'completed', payment: 'Efectivo', total: 20, subtotal: 25, discountTotal: 5, amountReceived: 30, change: 10, items: 2, products: [{ id: 'p-1', name: 'Producto QA', qty: 2, price: 10, imageUrl: '/qa-product.png', barcode: '740001' }] }
test('draft detail never claims applied payment even when a stale raw payment flag says paid',()=>{
  const view=render('SaleInvoicePage',{record:{...sale,status:'draft',payment:null,paymentStatus:'PAID',amountReceived:0,change:0,commercial:{state:'DRAFT',originEngagementId:'e',version:1,confirmedAt:null,fiscalState:'UNRECORDED'}}})
  assert.match(view.html,/Borrador/);assert.match(view.html,/Por definir al confirmar/)
  assert.ok(!view.html.includes('Monto pagado'));assert.ok(!view.html.includes('>Pagado<'))
})
test('service sale detail displays original billing unit and fractional quantity despite zero physical items',()=>{
  const view=render('SaleInvoicePage',{record:{...sale,items:0,lineCount:1,products:[{id:'s',name:'Asesoría original',qty:'0.125',unitLabel:'Hora',itemKind:'SERVICE',quantityDecimals:3,price:100,lineTotal:12.5}]}})
  assert.match(view.html,/Hora/);assert.match(view.html,/0.125/);assert.match(view.html,/Asesoría original/)
})

// Real presentation/shared controls; effects stay offline. External PDF/network operations are isolated.
function render(name, { record = sale, permissions = true, states = [record, false, null], brandFailure = false, detailQuery = {}, remoteRecord } = {}) {
  const target = path.join(root, name === 'SaleInvoicePage' ? 'modules/sales/SaleInvoicePage.tsx' : 'modules/sales/components/SaleDetailDialog.tsx')
  const shared = path.join(root, 'modules/sales/components/SaleDetailContent.tsx')
  const cache = new Map(), nodes = [], pdfs = [], closed = [], queries = []
  let state = 0
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.require = dependency => {
      if (dependency.endsWith('.css')) return {}
      if (dependency === '@/context/useTenant') return {useTenant:()=>({company:{id:'qa-company'},branch:{id:'qa-branch'},isConsolidated:false})}
      if (dependency === '@/components/layout/PageNavigation') return {usePageTrail(){}}
      if (dependency === '@/hooks/useAuthPermissions') return { useAuthPermissions: () => ({ hasPermission: () => permissions }) }
      if (dependency === '@/context/useAuth') return {useAuth:()=>({user:{id:'U'}})}
      if (dependency === '@/services/api') return {getAuthToken:()=> 'test-session'}
      if (dependency === '@/services/authSession') return {authSessionIdentity:()=> 'test-session',authSessionMatches:id=>id==='U'}
      if (dependency === './documents/useSaleDocument') return {useSaleDocument:()=>({pending:false,pdf:null,error:'',legacy:false,fallback:false,prepare:async()=>({kind:'LEGACY'}),download(){}})}
      if (dependency === '@/context/useModules') return { useModules: () => ({ isEnabled: () => true }) }
      if (dependency === '@/hooks/useSystemSettings') return { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ', companyName: 'Local QA', companyLogoUrl: '/logo.png' }) }
      if (dependency === '@/services/saleService') return { fetchSaleById: async () => { if (!remoteRecord) throw Error('Unexpected request'); return remoteRecord } }
      if (dependency === '@/hooks/useSales') return {}
      if (dependency === '@tanstack/react-query') return { useQuery: options => { queries.push(options); return { data: record, refetch() {}, ...detailQuery } } }
      if (dependency === './hooks') return { normalizeRawSale: raw => raw }
      if (dependency === '@/services/settingsService') return { getCompanyNamePublic: async () => { if (brandFailure) throw Error('Offline'); return { company_name: 'Empresa QA', company_logo_url: '/brand.png' } } }
      if (dependency === '@/utils/pdfBranding') return { resolvePdfLogoDataUrl: async () => 'data:image/png;base64,QA' }
      if (dependency === './documents/generateSaleInvoicePDF') return { generateSaleInvoicePDF: (record, options) => pdfs.push({ record, options }) }
      if (dependency === '@radix-ui/react-dialog') return { ...native(dependency), Portal: ({ children }) => children }
      if (dependency === 'react' && file === target && name === 'SaleInvoicePage') return { ...React, useState: initial => React.useState(state < states.length ? states[state++] : initial) }
      if (dependency === 'react/jsx-runtime' && [target, shared].includes(file)) {
        const capture = factory => (type, props, key) => {
          nodes.push({ type, props })
          return factory(type, props, key)
        }
        return { ...runtime, jsx: capture(runtime.jsx), jsxs: capture(runtime.jsxs) }
      }
      const local = dependency.startsWith('@/') ? path.join(root, dependency.slice(2)) : dependency.startsWith('.') ? path.resolve(path.dirname(file), dependency) : null
      if (!local) return native(dependency)
      return load(['', '.tsx', '.ts', '.js', '.mjs', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  const Component = load(target)[name]
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/ventas/V-001/factura'] }, React.createElement(Component, { sale: record, open: true, onOpenChange: value => closed.push(value), locale: 'es-GT', currencyCode: 'GTQ' })))
  return { html, nodes, pdfs, closed, queries }
}

test('a sale opened from a lightweight contact-history row fetches the full record before showing products or payment', async () => {
  const row = { ...sale, products: [], creditPaid: 0, isCredit: true }
  const remoteRecord = { id: sale.id, reference: sale.reference, date: sale.date, total: '20.00', adjusted_total: '20.00', payment_method: { name: 'Crédito', is_credit: true }, paymentEntries: [{ amount: '5.00' }], sale_items: [{ product_id: 'p-1', price: '10.00', qty: 2, product: { name: 'Producto completo' } }], customerContact: { id: 'contact-1', name: 'QA', image_url: '/qa-photo.webp' } }
  const view = render('SaleDetailDialog', { record: row, detailQuery: { data: undefined, isLoading: true }, remoteRecord })
  assert.ok(view.html.includes('Cargando detalle'))
  assert.ok(!view.html.includes('Abonos registrados'))
  assert.ok(!view.html.includes('Esta venta no tiene productos'))
  assert.equal(view.queries[0].enabled, true)
  const complete = await view.queries[0].queryFn()
  assert.equal(complete.products[0].name, 'Producto completo')
  assert.equal(complete.customerContact.imageUrl, '/qa-photo.webp')
  assert.equal(complete.creditPaid, 5)
})

test('a failed detail request shows an error and retry, not a partial sale or return action', () => {
  const view = render('SaleDetailDialog', { detailQuery: { data: undefined, isError: true, error: new Error('Sin conexión') } })
  assert.ok(view.html.includes('Sin conexión'))
  assert.ok(view.html.includes('Reintentar'))
  assert.ok(!view.html.includes('aria-label="Resumen de pago"'))
  assert.ok(!view.nodes.some(n => n.props['aria-label'] === 'Registrar devolución de V-001'))
})

for (const name of ['SaleInvoicePage', 'SaleDetailDialog']) {
  test(`${name} exposes a compact product table, client and payment regions`, () => {
    const view = render(name)
    assert.ok(view.html.includes('aria-label="Información de la venta"'))
    assert.ok(view.html.includes('aria-label="Resumen de pago"'))
    assert.ok(view.html.includes('<table'))
    assert.ok(view.html.includes('src="/qa-product.png"'))
    assert.ok(view.html.includes('123456-7'))
    assert.ok(view.html.includes('Ana QA'))
    assert.ok(view.html.includes('20.00'))
    assert.ok(!view.html.includes('bg-white/50'))
  })

  test(`${name} keeps a fully returned zero net total rather than the original amount`, () => {
    const view = render(name, { record: { ...sale, hasReturns: true, totalReturned: 20, adjustedTotal: 0 } })
    assert.ok(/Total neto<\/dt>\s*<dd[^>]*>[^<]*0\.00<\/dd>/.test(view.html), 'zero net total must survive display normalization')
  })

  test(`${name} preserves credit paid/balance and due date`, () => {
    const view = render(name, { record: { ...sale, payment: 'Crédito', isCredit: true, creditPaid: 5, creditBalance: 15, dueDate: '2026-11-08T12:00:00Z' } })
    assert.ok(view.html.includes('Saldo pendiente'))
    assert.ok(/Abonos registrados<\/dt>\s*<dd[^>]*>[^<]*5\.00<\/dd>/.test(view.html))
    assert.ok(/Saldo pendiente<\/dt>\s*<dd[^>]*>[^<]*15\.00<\/dd>/.test(view.html))
    assert.ok(view.html.includes('Vencimiento'))
  })
}

test('products and additional sale records stay visible without tabs absent from the reference', () => {
  const record = { ...sale, hasReturns: true, totalReturned: 10, adjustedTotal: 10, promotions: [{ id: 1, promotion_id: 'promo-1', discount_applied: 5, code_used: 'QA5', promotion: { id: 'promo-1', name: 'Oferta QA', type: { name: 'Cupón' } } }], returnDetails: [{ date: sale.date, status: 'Completada', reason: 'Prueba QA', totalRefund: 10, items: [{ productName: 'Producto QA', qty: 1, refund: 10 }] }], sale_dtes: [{ authorization: 'AUTH-QA', series: 'SER-QA', number: '001', emission_date: sale.date, provider: 'Proveedor QA', status: 'CERTIFIED', xml_url: 'https://example.test/qa.xml', pdf_url: 'https://example.test/qa.pdf' }] }
  const dte = render('SaleInvoicePage', { record })
  for (const expected of ['Oferta QA', 'Prueba QA', 'AUTH-QA', 'Productos', 'Productos devueltos', 'Producto QA × 1', 'Proveedor QA', 'Fecha de emisión']) assert.ok(dte.html.includes(expected), expected)
  assert.ok(!dte.html.includes('role="tablist"'), 'sale products must not be hidden behind a different tab')
  assert.ok(dte.html.includes('Actividad registrada'))
  assert.ok(!dte.html.includes('enviada por email'), 'do not invent email/history events')
  assert.ok(dte.html.includes('href="https://example.test/qa.xml"'))
  assert.ok(dte.html.includes('rel="noopener noreferrer"'))
  const plain = render('SaleInvoicePage')
  assert.ok(!plain.html.includes('Documento electrónico'))
  assert.ok(!plain.html.includes('role="tablist"'))
})

test('sale client block shows the linked contact image, address, phone and email', () => {
  const record = { ...sale, customerContact: { id: 'contact-1', name: 'Contacto actual QA', imageUrl: '/qa-contact.webp', taxId: '765432-1', address: 'Zona QA', phone: '5555-0101', email: 'qa@example.test' } }
  const view = render('SaleInvoicePage', { record })
  for (const expected of ['src="/qa-contact.webp"', 'Zona QA', '5555-0101', 'qa@example.test', 'href="/contactos/contact-1"']) assert.ok(view.html.includes(expected), expected)
  assert.ok(view.html.includes('Cliente QA'), 'preserve the customer name captured on the sale')
  assert.ok(view.html.includes('123456-7'), 'preserve the fiscal identity captured on the sale')
  const restricted = render('SaleInvoicePage', { record, permissions: false })
  assert.ok(!restricted.html.includes('href="/contactos/contact-1"'))
  const noImage = render('SaleInvoicePage')
  assert.ok(noImage.html.includes('src="/images/contact-no-image.svg"'))
})

for (const name of ['SaleInvoicePage', 'SaleDetailDialog']) {
  test(`${name} keeps all contact details in the column beside the photo`, () => {
    const record = { ...sale, customerContact: { id: 'contact-1', name: sale.customer, address: 'Zona QA', phone: '5555-0101', email: 'qa@example.test' } }
    const { nodes } = render(name, { record })
    const customer = nodes.find(node => node.props.className === 'sale-detail-customer')
    const details = React.Children.toArray(customer.props.children)[1]
    const content = renderToStaticMarkup(details)
    for (const expected of ['Cliente QA', '123456-7', 'Zona QA', '5555-0101', 'qa@example.test']) {
      assert.ok(content.includes(expected), `${expected} must stay beside the photo`)
    }
  })
}

test('detail return/exchange actions remain conditional on completed status and permission', () => {
  const allowed = render('SaleDetailDialog')
  const action = allowed.nodes.find(n => n.props['aria-label'] === 'Registrar devolución de V-001')
  assert.ok(action)
  action.props.onClick()
  assert.deepEqual(allowed.closed, [false])
  for (const options of [{ permissions: false }, { record: { ...sale, status: 'cancelled' } }]) {
    const view = render('SaleDetailDialog', options)
    assert.ok(!view.nodes.some(n => n.props['aria-label'] === 'Registrar devolución de V-001'))
  }
})

test('invoice never draws an old PDF after preparation fails or returns an obsolete response', async () => {
  const view = render('SaleInvoicePage')
  await view.nodes.find(n => n.props.onClick?.name === 'handlePrint').props.onClick()
  assert.equal(view.pdfs.length, 0)
})

test('print configuration is collapsed in the toolbar rather than a permanent section above sale details',()=>{
  const view=render('SaleInvoicePage')
  assert.match(view.html,/Opciones de impresión/)
  assert.ok(!view.html.includes('Destino previsto'))
  assert.ok(!view.html.includes('Hoja del comprobante'))
  assert.ok(!view.html.includes('Confirmación, pagos y emisión fiscal son procesos separados'))
})

test('cancelled sales can request their saved originals while drafts cannot generate sale documents',()=>{
  for(const [status,disabled] of [['cancelled',false],['completed',false],['draft',true]]){
    const view=render('SaleInvoicePage',{record:{...sale,status}})
    for(const handler of ['handlePrint','handleTicket']){
      const action=view.nodes.find(n=>n.props.onClick?.name===handler)
      assert.ok(action,handler);assert.equal(action.props.disabled,disabled,`${status}: ${handler}`)
    }
  }
})

test('invoice retains loading/error/empty states without presenting an empty sale as success', () => {
  assert.ok(render('SaleInvoicePage', { states: [null, true, null] }).html.includes('Cargando factura'))
  assert.ok(render('SaleInvoicePage', { states: [null, false, 'Sin conexión'] }).html.includes('Sin conexión'))
  assert.ok(render('SaleInvoicePage', { states: [null, false, null] }).html.includes('Venta no encontrada'))
  assert.equal(render('SaleDetailDialog', { record: null }).html, '')
})

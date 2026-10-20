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
const { assertPaginationOutside } = require('./pagination-assertions.cjs')
const root = path.resolve(__dirname, '../src')
const target = path.join(root, 'modules/sales/NewSalePage.tsx')
const product = { id: 'p-1', name: 'Producto QA', category: 'Bebidas', brand: 'QA', barcode: '740001', imageUrl: '/qa.png', stock: 20, price: 5, minStock: 0 }

function render({ state = {}, productsError = false, permissions = ['sales.create'], items = [{ ...product, qty: '2' }], products = [product],pricingReady=true,realCart,unitPreview } = {}) {
  const tree = ts.createSourceFile(target, fs.readFileSync(target, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const page = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'NewSalePage')
  const names = page.body.statements.flatMap(node => ts.isVariableStatement(node) ? node.declarationList.declarations.filter(d => ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'useState').map(d => d.name.elements[0].name.text) : [])
  const refNames=page.body.statements.flatMap(node=>ts.isVariableStatement(node)?node.declarationList.declarations.filter(d=>ts.isCallExpression(d.initializer)&&d.initializer.expression.getText(tree)==='useRef').map(d=>d.name.text):[])
  const values = { productLayout: 'flat', selectedRegisterId: 'register', cashCheckDone: true, cashSessionOpen: true, cashRegisterMeta: { id: 'register', name: 'Caja QA' }, paymentMethod: { id: 1, name: 'Efectivo', is_credit: false }, amountReceived: '20', ...state }
  const nodes = [], notifications = [], writes = [], quantities = [], promotionRequests = [], cartOptions = [], cache = new Map()
  let index = 0,refIndex=0
  const pricingContext=JSON.stringify([products.map(p=>p.unitConfiguration?[p.id,p.unitValues,p.unitConfiguration]:[p.id,p.price,p.priceWholesale,p.pricePromotion,p.promotionValidUntil]),values.salesChannel || 'POS',values.pickedCustomerId==='__none__'?undefined:values.pickedCustomerId])
  const cart = { cartItems: items, hasInvalidQuantities:false,lineTotals:Object.fromEntries(items.map(item=>[item.id,(Number(item.qty)*item.price).toFixed(2)])),cartTotal: items.reduce((sum, item) => sum + Number(item.qty) * item.price, 0), adminAuthorizedProducts: new Set(), repriceCartLines() {}, clearCart() {}, updateQuantity: (...args) => quantities.push(args), removeFromCart() {}, hydrateFromLines() {}, availabilityDialog: { open: false }, adminAuthDialog: { open: false } }
  const overrides = {
    '@/context/useTenant': {useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},
    '@/hooks/use-toast': { useToast: () => ({ toast: value => notifications.push(value) }) },
    '@tanstack/react-query': { useQuery: options => ({ data: options.queryKey[0] === 'credit-check' ? { ok: true } : [], isSuccess: true }), useQueryClient: () => ({ invalidateQueries: async () => {}, fetchQuery: async () => [] }) },
    '@/hooks/useProducts': { PRODUCTS_QUERY_KEY: ['products'], useAllProducts: () => ({ data: products, isLoading: false, isFetching: false, isSuccess: !productsError, isError: productsError, refetch() {} }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: [] }) },
    '@/hooks/usePaymentMethods': { usePaymentMethods: () => ({ data: [{ id: 1, name: 'Efectivo', is_credit: false }, { id: 2, name: 'Crédito', is_credit: true }] }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...codes) => codes.some(code => permissions.includes(code)) }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', timezone: 'America/Guatemala', currencyCode: 'GTQ', companyName: 'QA', vatRegime: 'general', ivaRate: 12, salesAllowCredit: true, salesShowFiscalFields: true, salesShowChannels: true }) },
    '@/hooks/useExperienceProfile': { useExperienceProfile: () => ({ profile: 'standard', isCompact: false, showAdvancedByDefault: false }) },
    '@/context/useAuth': { useAuth: () => ({ user: { id: 'user', role: { name: 'admin' } } }) },
    '@/context/useModules': { useModules: () => ({ isEnabled: () => false }) },
    '@/hooks/usePromotions': { usePromotions: options => { promotionRequests.push(options); return { appliedPromotions: [], promotionCodes: [], clearPromotions() {} } } },
    './hooks': { useCart: options => {cartOptions.push(options);return realCart??cart}, useSalesData: () => ({ refreshSales() {} }) },
    './components': { AvailabilityDialog: () => null, AdminAuthDialog: () => null, PromotionCodeInput: () => null, SavedCustomerMany2One: () => null },
    '@/modules/receivables': { checkCustomerCredit() { throw Error('Unexpected request') } },
    '@/modules/cash-closure': { CASH_SESSION_CURRENT_QUERY_KEY: ['cash-current'] },
    '@/services/api': { apiFetch() { throw Error('Unexpected request') }, getApiBaseUrl: () => '' },
    '@/services/saleService': { createSale: async payload => { writes.push(payload); return { id: 'sale' } } },
    './checkout/useCheckoutFlow': {useCheckoutFlow:(scope,allowed,onConfirmed)=>({pending:false,attempt:null,error:null,isCurrent:()=>true,reconcile:async()=>{},submit:async(kind,payload)=>{writes.push(payload);onConfirmed({saleId:'sale',kind},true)}})},
    './documents/saleTicketRecovery':{downloadSavedSaleTicket:async()=>{}},
    '@/services/settingsService': { getCompanyNamePublic: async () => ({ company_name: 'QA' }) },
    '@/utils/pdfBranding': { resolvePdfLogoDataUrl: async () => null },
    './documents/generateSaleTicket': { generateSaleTicket() {} },
    './CashRegisterPicker': { CashRegisterPicker: () => React.createElement('p', null, 'Seleccionar caja') },
    './OpenCashRegisterPrompt': { OpenCashRegisterPrompt: () => React.createElement('p', null, 'Abrir caja') },
  }
  if(unitPreview)overrides['@/modules/inventory/units/public']={...require('./helpers/loadReportModule.cjs').loadReportModule('../inventory/units/public.ts',{'@/services/api':{}}),previewUnitLine:unitPreview}
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.require = name => {
      if (name.endsWith('.css')) return {}
      if (name === 'react' && file === target) return { ...React, useState: initial => { const name = names[index++]; return React.useState(name in values ? values[name] : initial) },useRef:initial=>React.useRef(refNames[refIndex++]==='pricingReadyRef' && pricingReady ? pricingContext : initial) }
      if (name === 'react/jsx-runtime' && file === target) return { ...runtime, jsx: (type, props, key) => { nodes.push({ type, props }); return runtime.jsx(type, props, key) }, jsxs: (type, props, key) => { nodes.push({ type, props }); return runtime.jsxs(type, props, key) } }
      if (name in overrides) return overrides[name]
      const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
      if (!local) return native(name)
      const alias = '@/' + path.relative(root, local)
      if (alias in overrides) return overrides[alias]
      return load(['', '.tsx', '.ts', '.js', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  const Page = load(target).default
  return { html: renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page))), nodes, notifications, writes, quantities, promotionRequests,cartOptions }
}

test('actual POS submit reconciles authoritative prepared price and requires cashier review before writing',async()=>{
 const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness()
 const p={...product,kind:'STANDARD',unitValues:{price:'5',cost:'1',stock:'20',minStock:'0',priceWholesale:null,pricePromotion:null},unitConfiguration:{base_unit_id:'u',base_unit:{id:'u',code:'UNIT',name:'Unidad',label:'ud'},quantity_decimals:0,unit_revision:1,presentations:[],default_sale_presentation_id:null}}
 const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}})
 const cart=()=>h.render(()=>useCart({availableProducts:[p]}));cart().addToCart(p)
 const preview=async()=>({qty:'1',base_qty:'1',unit_metadata_version:2,unit_revision:1,unit_price:'6',line_total:'6.00',unit_snapshot:cart().cartItems[0].unitSelection.snapshot})
 try{
  const first=render({products:[p],items:cart().cartItems,realCart:cart(),unitPreview:preview})
  await first.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick()
  assert.equal(first.writes.length,0);assert.match(first.notifications.at(-1).description,/Revisa el carrito/);assert.equal(cart().cartTotalExact,'6.00')
  const second=render({products:[p],items:cart().cartItems,realCart:cart(),unitPreview:preview})
  await second.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();assert.equal(second.writes.length,1);assert.equal(second.writes[0].items[0].price,'6')
 }finally{h.unmount()}
})

test('POS loaded order uses original service precision, price and remaining invoice cents',()=>{
  const current={...product,kind:'SERVICE',quantityDecimals:0,serviceUnitLabel:'Sesión',price:50}
  const loadedOrder={id:'o',status:'PARTIALLY_FULFILLED',fulfillment_mode:'LEGACY',lines:[{id:'l',product_id:product.id,item_kind:'SERVICE',item_name:'Asesoría original',unit_label:'Hora',quantity_decimals:2,qty:'1',qty_fulfilled:'0.5',unit_price:'19.99',line_total:'19.99'}]}
  const view=render({state:{loadedOrder},products:[current],items:[{...current,qty:'0.5'}]})
  assert.match(view.html,/9\.99/)
  const original=view.cartOptions[0].availableProducts[0]
  assert.equal(original.quantityDecimals,2)
  assert.equal(original.serviceUnitLabel,'Hora')
  assert.equal(view.cartOptions[0].getUnitPrice(original),19.99)
})

test('POS preserves canonical fractional service quantity for promotion validation', () => {
  const view=render({items:[{...product,kind:'SERVICE',serviceUnitLabel:'Hora',quantityDecimals:2,qty:'1.5'}]})
  assert.equal(view.promotionRequests[0].cartItems[0].qty,'1.5')
})

test('POS cart uses a single table with image, unit price and accessible quantity actions', () => {
  const view = render()
  assert.match(view.html, /<table\b/)
  assert.match(view.html, /aria-label="Productos en la venta"/)
  assert.match(view.html, /aria-label="Cantidad de Producto QA"/)
  assert.match(view.html, /aria-label="Quitar Producto QA"/)
  assert.match(view.html, /src="\/qa.png"/)
  assert.match(view.html, /Precio unitario/)
  view.nodes.find(node => node.props['aria-label'] === 'Aumentar cantidad de Producto QA').props.onClick()
  assert.deepEqual(view.quantities, [['p-1', '3']])
})

test('POS exposes a checkout region and paginates outside the unframed catalog', () => {
  const view = render({ products: Array.from({ length: 10 }, (_, i) => ({ ...product, id: `p-${i}` })) })
  assert.match(view.html, /aria-label="Total y registro de la venta"/)
  assert.match(view.html, /aria-label="Buscar productos"/)
  assertPaginationOutside(view.html)
  assert.doesNotMatch(view.html, /Sin imagen/)
})

test('POS product query errors offer retry instead of claiming no matches', () => {
  const view = render({ productsError: true, products: [] })
  assert.match(view.html, /No se pudieron cargar los productos/)
  assert.match(view.html, /Reintentar/)
  assert.doesNotMatch(view.html, /No hay productos que coincidan/)
})

test('POS keeps cached products and pagination when a background refresh fails', () => {
  const view = render({ productsError: true, products: Array.from({ length: 10 }, (_, i) => ({ ...product, id: `p-${i}` })) })
  assert.ok(view.html.includes('No se pudieron actualizar los productos'))
  assert.ok(view.html.includes('Últimos datos disponibles'))
  assert.ok(view.html.includes('pos-product-row'))
  assertPaginationOutside(view.html)
})

test('POS uses one bounded cart scroller and preserves document order when stacked', () => {
  const css = fs.readFileSync(path.join(root, 'modules/sales/pos.css'), 'utf8')
  assert.ok(css.includes('.pos-cart-scroll>div{max-height:320px;overflow:auto}'))
  assert.ok(!css.includes('.pos-catalog-column{grid-row:1}'))
})

test('POS cash validation still blocks an insufficient amount without a write', async () => {
  const view = render({ state: { amountReceived: '3' } })
  const submit = view.nodes.find(node => node.props.onClick?.name === 'handleSubmit')
  assert.equal(submit.props.disabled, true)
  await submit.props.onClick()
  assert.deepEqual(view.writes, [])
  assert.equal(view.notifications.at(-1).title, 'Monto insuficiente')
})

test('POS blocks credit without a registered customer and preserves its abono controls', async () => {
  const view = render({ state: { paymentMethod: { id: 2, name: 'Crédito', is_credit: true } } })
  assert.match(view.html, /Abono recibido hoy/)
  assert.match(view.html, /Registrar venta a crédito/)
  const submit = view.nodes.find(node => node.props.onClick?.name === 'handleSubmit')
  assert.equal(submit.props.disabled, true)
  await submit.props.onClick()
  assert.deepEqual(view.writes, [])
  assert.equal(view.notifications.at(-1).title, 'Falta el cliente')
})

test('POS still requires an available cash session and sale permission', async () => {
  assert.match(render({ state: { cashSessionOpen: false } }).html, /Abrir caja/)
  assert.doesNotMatch(render({ state: { cashSessionOpen: false } }).html, /Total y registro de la venta/)
  const view = render({ permissions: [] })
  await view.nodes.find(node => node.props.onClick?.name === 'handleSubmit').props.onClick()
  assert.deepEqual(view.writes, [])
  assert.equal(view.notifications.at(-1).title, 'Sin permiso para crear ventas')
})

test('POS retains cash change and credit abono/due-date payloads without real requests', async () => {
  const originalFrame = global.requestAnimationFrame
  global.requestAnimationFrame = () => 0
  try {
    const cash = render()
    await cash.nodes.find(node => node.props.onClick?.name === 'handleSubmit').props.onClick()
    assert.equal(cash.writes.length, 1)
    assert.equal(cash.writes[0].amount_received, 20)
    assert.equal(cash.writes[0].change, 10)
    assert.equal(cash.writes[0].cash_register_id, 'register')
    assert.deepEqual(cash.writes[0].items, [{ product_id: 'p-1', price: 5, qty: '2' }])
    assert.equal(cash.notifications.at(-1).title, 'Venta registrada correctamente')

    const credit = render({ state: { paymentMethod: { id: 2, name: 'Crédito', is_credit: true }, pickedCustomerId: 'client', customer: 'Cliente QA', isFinalConsumer: false, creditDueDate: '2026-11-08', initialCreditPayment: '3', initialCreditMethod: '1' } })
    await credit.nodes.find(node => node.props.onClick?.name === 'handleSubmit').props.onClick()
    assert.equal(credit.writes.length, 1)
    assert.equal(credit.writes[0].customer_contact_id, 'client')
    assert.equal(credit.writes[0].due_date, '2026-11-08')
    assert.deepEqual(credit.writes[0].initial_payment, { amount: 3, payment_method_id: 1 })
    assert.equal(credit.writes[0].amount_received, undefined)
    assert.equal(credit.notifications.at(-1).title, 'Venta a crédito registrada')
  } finally {
    if (originalFrame === undefined) delete global.requestAnimationFrame
    else global.requestAnimationFrame = originalFrame
  }
})

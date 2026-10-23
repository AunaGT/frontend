const test=require('node:test'),assert=require('node:assert/strict')
const {renderPos:render,product}=require('./helpers/posPageHarness.cjs')
const {assertPaginationOutside}=require('./pagination-assertions.cjs')

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

test('POS cart exposes compact selectable lines with exact totals and removal actions', () => {
  const view=render({state:{saleStep:'products'}})
  assert.equal(view.html.includes('<table'),false)
  assert.match(view.html,/aria-label="Productos en la venta"/)
  assert.match(view.html,/2 × Producto QA/)
  assert.ok(view.html.includes('src="/qa.png"'))
  const select=view.nodes.find(n=>n.props['aria-label']==='Seleccionar Producto QA, unidad')
  select.props.onClick();assert.equal(view.stateUpdates.selectedLineKey,'p-1')
  view.nodes.find(n=>n.props['aria-label']==='Quitar Producto QA').props.onClick()
  assert.deepEqual(view.removals,['p-1'])
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


test('POS catalog product is one keyboard-activatable tile without nested add controls',()=>{
 const view=render()
 const tile=view.nodes.find(n=>n.type==='button'&&n.props['aria-label']==='Agregar Producto QA')
 assert.ok(tile,'The product itself must be an accessible button')
 assert.equal(tile.props.type,'button')
 assert.match(view.html,/pos-product-tile/)
 assert.doesNotMatch(view.html,/>Agregar<\/button>/)
})

test('POS category uses its configured image and remains navigable without an image',()=>{
 const view=render({categories:[{id:'c',name:'Bebidas',image_url:'/category-bebidas.webp'}],state:{productLayout:'byCategory'}})
 assert.match(view.html,/src="\/category-bebidas.webp"/)
 assert.ok(view.nodes.some(n=>n.props['aria-label']==='Ver categoría Bebidas'&&typeof n.props.onClick==='function'))
 const noImage=render({state:{productLayout:'byCategory'}})
 assert.doesNotMatch(noImage.html,/src="undefined"|src="null"/)
 assert.ok(noImage.nodes.some(n=>n.props['aria-label']==='Ver categoría Bebidas'))
})

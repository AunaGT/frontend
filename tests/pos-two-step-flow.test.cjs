const test=require('node:test'),assert=require('node:assert/strict')
const {renderPos:render,product}=require('./helpers/posPageHarness.cjs')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const cash={id:1,name:'Efectivo',is_credit:false},credit={id:2,name:'Crédito',is_credit:true}
const methodEffect=view=>view.effects.find(e=>e.deps?.length===3&&typeof e.deps[1]==='boolean'&&Array.isArray(e.deps[2]))
test('successful sale uses the existing notification with a finite short duration',async()=>{
 const initial=render();await initial.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick()
 const success=initial.notifications.find(n=>n.title==='Venta registrada correctamente')
 assert.ok(success);assert.equal(success.duration,4000)
})
test('POS after a successful sale has no permanent success panel or drawer simulator',()=>{
 const after=render({state:{lastCheckout:{saleId:'sale',scopeKey:JSON.stringify({companyId:'A',branchId:'B',userId:'user'}),ticketFailed:false,ticketPending:false}}})
 assert.doesNotMatch(after.html,/Venta registrada|Descargar ticket|Ver venta|Simular apertura/)
 assert.equal(after.nodes.some(n=>n.type?.name==='DrawerSimulationAction'),false)
})
test('ticket routing info is a short notification, not a persistent POS message',async()=>{
 const view=render({downloadTicket:async(_id,_options,_owner,_request,tracking)=>tracking.notice('Descarga sin registro de impresión. La venta sigue guardada.')})
 await view.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick()
 const info=view.notifications.find(n=>n.title==='Ticket de venta')
 assert.ok(info);assert.match(info.description,/Descarga sin registro/);assert.equal(info.duration,5000)
 assert.equal(view.writes.length,1)
 const after=render({state:{...view.stateUpdates}})
 assert.doesNotMatch(after.html,/Descarga sin registro de impresión/)
})
test('reloaded checkout without selected register still shows saved products, cause and recovery action',()=>{
 let retried=0
 const view=render({state:{selectedRegisterId:null,cashSessionOpen:false},items:[],checkoutOverrides:{attempt:{companyId:'A',branchId:'B',userId:'U',kind:'SALE',state:'UNKNOWN',version:2,key:'K',payload:{items:[{product_id:product.id,qty:'2.5',price:'5'}]},lastError:'Falló el envío original'},canRetry:true,retry:()=>retried++}})
 assert.match(view.html,/Producto QA/);assert.match(view.html,/2.5/);assert.match(view.html,/Falló el envío original/);assert.match(view.html,/Reintentar este cobro/)
 view.nodes.find(n=>n.type?.name==='CheckoutRecoveryNotice').props.onRetry();assert.equal(retried,1);assert.deepEqual(view.writes,[])
 const rejected=render({state:{selectedRegisterId:null},checkoutOverrides:{error:'Método deshabilitado'}})
 assert.match(rejected.html,/Método deshabilitado/);assert.match(rejected.html,/Seleccionar caja/)
})
const retainedRefs=view=>Object.fromEntries(Object.entries(view.pageRefs).map(([name,ref])=>[name,ref.current]))
const runStepFocus=(view,step)=>view.effects.filter(e=>e.deps?.length===2&&e.deps[0]===step).forEach(e=>e.run())

test('explicit payment navigation focuses its heading once without adding a tab stop',()=>{
 const focused=[],state={saleStep:'products',paymentMethod:null}
 const compose=render({state});compose.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.onClick()
 const paymentState={...state,...compose.stateUpdates},payment=render({state:paymentState,refs:retainedRefs(compose)})
 const heading=payment.nodes.find(n=>n.type==='h2'&&n.props.id==='pos-payment-title')
 if(heading.props.ref)heading.props.ref.current={focus:()=>focused.push('payment')}
 runStepFocus(payment,'payment');runStepFocus(payment,'payment')
 assert.deepEqual(focused,['payment']);assert.equal(heading.props.tabIndex,-1)
 assert.deepEqual(payment.writes,[]);assert.equal(payment.stateUpdates.paymentMethod,undefined)
})

test('returning from payment restores focus to the review button in the mobile sale panel',()=>{
 const focused=[],paymentState={saleStep:'payment',paymentMethod:null},payment=render({state:paymentState})
 payment.nodes.find(n=>n.props.className==='pos-payment-back').props.onClick()
 const back=render({state:{...paymentState,...payment.stateUpdates},refs:retainedRefs(payment)})
 const review=back.nodes.find(n=>n.props['aria-label']==='Ir al pago')
 if(review.props.ref)review.props.ref.current={focus:()=>focused.push('products')}
 runStepFocus(back,'products');runStepFocus(back,'products')
 assert.deepEqual(focused,['products']);assert.equal(payment.stateUpdates.mobileView,'sale')
 assert.deepEqual(payment.writes,[]);assert.deepEqual(back.writes,[])
 assert.equal(back.stateUpdates.paymentMethod,undefined)
})

test('initial rendering and blocked payment navigation do not steal keyboard focus',()=>{
 const focused=[],state={saleStep:'products',paymentMethod:null}
 const initial=render({state,items:[]})
 for(const node of initial.nodes)if(node.props.ref&&['pos-payment-title','Ir al pago'].includes(node.props.id??node.props['aria-label']))node.props.ref.current={focus:()=>focused.push('unexpected')}
 runStepFocus(initial,'products')
 initial.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.onClick()
 const blocked=render({state:{...state,...initial.stateUpdates},refs:retainedRefs(initial),items:[]})
 runStepFocus(blocked,'products')
 assert.deepEqual(focused,[]);assert.equal(initial.stateUpdates.saleStep,undefined)
 const payment=render({state:{saleStep:'payment',paymentMethod:null}})
 const heading=payment.nodes.find(n=>n.props.id==='pos-payment-title')
 if(heading.props.ref)heading.props.ref.current={focus:()=>focused.push('unexpected')}
 runStepFocus(payment,'payment');assert.deepEqual(focused,[])
})

test('a focus request from another company context is discarded',()=>{
 const focused=[],state={saleStep:'products',paymentMethod:null},compose=render({state})
 compose.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.onClick()
 const refs=retainedRefs(compose)
 const payment=render({state:{...state,...compose.stateUpdates},refs:{...refs,stepFocusRequest:{...refs.stepFocusRequest,scope:'previous-company'}}})
 const heading=payment.nodes.find(n=>n.props.id==='pos-payment-title')
 if(heading.props.ref)heading.props.ref.current={focus:()=>focused.push('unexpected')}
 runStepFocus(payment,'payment');assert.deepEqual(focused,[])
 assert.equal(payment.pageRefs.stepFocusRequest.current,null)
})

function presentationCart(stock='40'){
 const configured={...product,kind:'STANDARD',unitValues:{price:'5',cost:'1',stock,minStock:'0',priceWholesale:null,pricePromotion:null},unitConfiguration:{base_unit_id:'unit',base_unit:{id:'unit',name:'Unidad',code:'UNIT',label:'ud',quantity_decimals:0},quantity_decimals:0,unit_revision:1,default_sale_presentation_id:null,presentations:[{id:'box',name:'Caja',label:'caja',active:true,sale_enabled:true,purchase_enabled:true,version:1,factor:'3',quantity_decimals:0,prices:{LIST:'15'}}]}}
 const h=require('./helpers/reportHookHarness.cjs').hookHarness()
 const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}})
 return{configured,cart:()=>h.render(()=>useCart({availableProducts:[configured]})),close:()=>h.unmount()}
}
const quantityInput=view=>view.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto QA')
const presentationFields=view=>view.nodes.find(n=>n.type?.name==='UnitLineFields')

test('removing another real cart line preserves a pending selected quantity and payment guard',()=>{
 const f=presentationCart()
 try{
  f.cart().addToCart(f.configured,{presentationId:null});f.cart().addToCart(f.configured,{presentationId:'box'})
  const [base,box]=f.cart().cartItems,state={saleStep:'products',selectedLineKey:box.lineKey}
  const view=render({state,realCart:f.cart(),products:[f.configured]});quantityInput(view).props.onChange({target:{value:'4'}})
  const pendingState={...state,...view.stateUpdates},pending=render({state:pendingState,realCart:f.cart(),products:[f.configured]})
  pending.nodes.find(n=>n.props['data-line-key']===base.lineKey).props.onClick()
  const after=render({state:{...pendingState,...pending.stateUpdates},realCart:f.cart(),products:[f.configured]})
  assert.equal(quantityInput(after).props.value,'4');assert.equal(after.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.disabled,true)
  assert.equal(f.cart().cartItems[0].qty,'1')
 }finally{f.close()}
})

for(const rejection of ['duplicate','availability'])test(`rejected ${rejection} presentation retains actual selected line and pending edit`,()=>{
 const f=presentationCart(rejection==='availability'?'5':'40')
 try{
  f.cart().addToCart(f.configured,{presentationId:null})
  if(rejection==='duplicate')f.cart().addToCart(f.configured,{presentationId:'box'})
  const base=f.cart().cartItems[0]
  if(rejection==='availability'){
   f.cart().updateQuantity(base.lineKey,'2')
   f.cart().addToCart({...product,id:'other',name:'Otro producto'})
  }
  const state={saleStep:'products',selectedLineKey:base.lineKey,actionPanel:'unit'}
  const view=render({state,realCart:f.cart(),products:[f.configured]});quantityInput(view).props.onChange({target:{value:'4'}})
  const pendingState={...state,...view.stateUpdates},pending=render({state:pendingState,realCart:f.cart(),products:[f.configured]})
  presentationFields(pending).props.onSelect('box')
  const after=render({state:{...pendingState,...pending.stateUpdates},realCart:f.cart(),products:[f.configured]})
  assert.equal(after.nodes.find(n=>n.props['aria-label']==='Seleccionar Producto QA, ud').props['aria-pressed'],true)
  assert.equal(quantityInput(after).props.value,'4');assert.equal(after.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.disabled,true)
  assert.equal(f.cart().cartItems[0].unitSelection.presentationId,null)
  after.effects.find(e=>e.deps?.[0]===pending.stateUpdates.unitChange).run()
  const settled=render({state:{...pendingState,...pending.stateUpdates,...after.stateUpdates},realCart:f.cart(),products:[f.configured]})
  assert.equal(quantityInput(settled).props.value,'4')
  assert.equal(presentationFields(settled).props.selection.presentationId,null)
 }finally{f.close()}
})

test('accepted presentation follows the changed real line rather than the last cart line',()=>{
 const f=presentationCart()
 try{
  f.cart().addToCart(f.configured,{presentationId:null})
  f.cart().addToCart({...product,id:'other',name:'Otro producto'})
  const base=f.cart().cartItems[0],state={saleStep:'products',selectedLineKey:base.lineKey,actionPanel:'unit'}
  const view=render({state,realCart:f.cart(),products:[f.configured]});presentationFields(view).props.onSelect('box')
  const next=render({state:{...state,...view.stateUpdates},realCart:f.cart(),products:[f.configured]})
  assert.equal(next.nodes.find(n=>n.props['aria-label']==='Seleccionar Producto QA, caja').props['aria-pressed'],true)
  assert.equal(presentationFields(next).props.selection.presentationId,'box')
  next.effects.find(e=>e.deps?.[0]===view.stateUpdates.unitChange).run()
  assert.equal(next.stateUpdates.selectedLineKey,f.cart().cartItems[0].lineKey)
  assert.equal(next.stateUpdates.unitChange,null)
 }finally{f.close()}
})

test('loading methods does not select one, retired methods clear, explicit selections survive refresh',()=>{
 const initial=render({state:{paymentMethod:null}});methodEffect(initial).run()
 assert.equal(initial.stateUpdates.paymentMethod??null,null)
 const picked=render({state:{paymentMethod:cash}});methodEffect(picked).run()
 assert.equal(picked.stateUpdates.paymentMethod??cash,cash)
 const retired=render({state:{paymentMethod:cash},methods:[credit]});methodEffect(retired).run()
 assert.equal(retired.stateUpdates.paymentMethod,null)
})

test('entering payment is navigation only, keeps cart and does not require selecting payment early',()=>{
 const view=render({state:{saleStep:'products',paymentMethod:null}})
 const next=view.nodes.find(n=>n.props['aria-label']==='Ir al pago')
 assert.ok(next);assert.equal(next.props.disabled,false);next.props.onClick()
 assert.equal(view.stateUpdates.saleStep,'payment');assert.deepEqual(view.writes,[])
 const payment=render({state:{saleStep:'payment',paymentMethod:null}})
 assert.match(payment.html,/Vamos a cobrar/)
 assert.ok(payment.nodes.find(n=>n.props['data-step']==='payment'))
 const confirm=payment.nodes.find(n=>n.props.onClick?.name==='handleSubmit');assert.equal(confirm.props.disabled,true)
 confirm.props.onClick();assert.deepEqual(payment.writes,[])
})

test('unapplied quantity blocks payment and applies exact text to the selected line only',()=>{
 const view=render({state:{saleStep:'products'},items:[{...product,qty:'2',lineKey:'selected-line'}]})
 view.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto QA').props.onChange({target:{value:'3'}})
 const pending=render({state:{saleStep:'products',...view.stateUpdates},items:[{...product,qty:'2',lineKey:'selected-line'}]})
 const next=pending.nodes.find(n=>n.props['aria-label']==='Ir al pago');assert.equal(next.props.disabled,true);next.props.onClick();assert.equal(pending.stateUpdates.saleStep,undefined)
 pending.nodes.find(n=>n.props['aria-label']==='Aplicar cantidad').props.onClick()
 assert.deepEqual(pending.quantities,[['selected-line','3']]);assert.deepEqual(pending.writes,[])
})

test('availability authorization in progress cannot be bypassed by payment navigation',()=>{
 const view=render({state:{saleStep:'products'},cartOverrides:{availabilityDialog:{open:true,product:null,requestedQty:5,availableStock:2}}})
 const next=view.nodes.find(n=>n.props['aria-label']==='Ir al pago');assert.equal(next.props.disabled,true);next.props.onClick()
 assert.equal(view.stateUpdates.saleStep,undefined);assert.deepEqual(view.writes,[])
})

test('separate unit presentations retain exact identity during quantity edit and removal',()=>{
 const configured={...product,kind:'STANDARD',unitValues:{price:'5',cost:'1',stock:'40',minStock:'0',priceWholesale:null,pricePromotion:null},unitConfiguration:{base_unit_id:'unit',base_unit:{id:'unit',name:'Unidad',code:'UNIT',label:'ud',quantity_decimals:0},quantity_decimals:0,unit_revision:1,default_sale_presentation_id:null,presentations:[{id:'box',name:'Caja',label:'caja',active:true,sale_enabled:true,purchase_enabled:true,version:1,factor:'3',quantity_decimals:0,prices:{LIST:'15'}}]}}
 const {selectProductUnit,unitCartKey}=loadReportModule('../inventory/units/selection.ts'),base=selectProductUnit(configured,null),box=selectProductUnit(configured,'box'),baseKey=unitCartKey(product.id,base),boxKey=unitCartKey(product.id,box)
 const items=[{...configured,qty:'2',unitSelection:base,lineKey:baseKey},{...configured,qty:'1',unitSelection:box,lineKey:boxKey}],state={saleStep:'products',selectedLineKey:boxKey}
 const view=render({state,items,products:[configured]});view.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto QA').props.onChange({target:{value:'2'}})
 const edited=render({state:{...state,...view.stateUpdates},items,products:[configured]});edited.nodes.find(n=>n.props['aria-label']==='Aplicar cantidad').props.onClick()
 assert.deepEqual(edited.quantities,[[boxKey,'2']]);assert.notEqual(baseKey,boxKey)
 const remove=edited.nodes.find(n=>n.props['data-line-key']===boxKey&&n.props['aria-label']==='Quitar Producto QA');assert.ok(remove);remove.props.onClick();assert.deepEqual(edited.removals,[boxKey])
})

test('tenant reset clears the payment method, amount and page step without choosing an alternative',()=>{
 const view=render({refs:{oldCartScope:'previous-company'},state:{saleStep:'payment',paymentMethod:cash,amountReceived:'100'}})
 const effect=view.effects.find(e=>e.deps?.length===1&&typeof e.deps[0]==='string'&&e.deps[0].includes('companyId'))
 assert.ok(effect);effect.run()
 assert.equal(view.stateUpdates.paymentMethod,null);assert.equal(view.stateUpdates.amountReceived,'');assert.equal(view.stateUpdates.saleStep,'products')
})

test('a stale unavailable method cannot be submitted before selection cleanup effect runs',async()=>{
 const view=render({state:{paymentMethod:cash},methods:[credit]})
 const confirm=view.nodes.find(n=>n.props.onClick?.name==='handleSubmit');assert.equal(confirm.props.disabled,true)
 await confirm.props.onClick();assert.deepEqual(view.writes,[])
})

test('fractional services use their configured precision through the touch editor',()=>{
 const service={...product,kind:'SERVICE',serviceUnitLabel:'hora',quantityDecimals:2},items=[{...service,qty:'1.25'}],state={saleStep:'products'}
 const view=render({state,products:[service],items})
 view.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto QA').props.onChange({target:{value:'1.50'}})
 const edited=render({state:{...state,...view.stateUpdates},products:[service],items})
 edited.nodes.find(n=>n.props['aria-label']==='Aplicar cantidad').props.onClick()
 assert.deepEqual(edited.quantities,[['p-1','1.5']])
})

test('new confirmed sale resets payment and composing step without retaining cash as default',async()=>{
 const view=render();await view.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick()
 assert.equal(view.writes.length,1);assert.equal(view.stateUpdates.paymentMethod,null);assert.equal(view.stateUpdates.amountReceived,'');assert.equal(view.stateUpdates.saleStep,'products')
})

test('removing a loaded order starts composing without reusing its chosen payment',()=>{
 const view=render({state:{saleStep:'payment',paymentMethod:cash,loadedOrder:{id:'order',lines:[],payment_condition:'CREDIT'}}})
 view.nodes.find(n=>n.props.children==='Quitar pedido').props.onClick()
 assert.equal(view.stateUpdates.paymentMethod,null);assert.equal(view.stateUpdates.amountReceived,'');assert.equal(view.stateUpdates.saleStep,'products')
})

test('explicit draft recovery restores only a still available payment method',async()=>{
 const saved=global.localStorage,map=new Map()
 global.localStorage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}
 const {saveNewSaleDraft}=loadReportModule('../../services/saleDraftStorage.ts')
 try{
  for(const [id,want]of [[99,null],[1,cash]]){
   saveNewSaleDraft('user',{customer:'Consumidor final',customerNit:'',isFinalConsumer:true,paymentMethodId:id,amountReceived:'20',lines:[],adminAuthorizedProductIds:[],promotionCodes:[],productPageSize:9},{companyId:'A',branchId:'B'})
   const view=render({state:{hasStoredDraft:true,paymentMethod:credit}})
   view.nodes.find(n=>n.props.children==='Recuperar venta guardada').props.onClick()
   await new Promise(setImmediate)
   assert.deepEqual(view.stateUpdates.paymentMethod,want)
  }
 }finally{global.localStorage=saved}
})

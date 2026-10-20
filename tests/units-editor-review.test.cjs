const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')
const product={id:'p',name:'Producto',barcode:'CODE',kind:'STANDARD',price:999,stock:999,unitValues:{price:'6',priceWholesale:'5',cost:'2',stock:'100',minStock:'0'},unitConfiguration:{base_unit_id:'u',base_unit:{id:'u',label:'unidades',name:'Unidad',code:'UNIT'},quantity_decimals:0,unit_revision:3,default_sale_presentation_id:'box',presentations:[{id:'box',version:2,name:'Caja',label:'caja',factor:'3',quantity_decimals:0,active:true,sale_enabled:true,prices:{}}]}}
function editor(kind){
  const h=hookHarness(),nodes=[],requests=[],toasts=[],pricingRequests=[];let mutation,pricingHandler,preparationHandler,tier='WHOLESALE'
  const price=async input=>{pricingRequests.push(input);return pricingHandler?pricingHandler(input):({unit_prices:{p:999},price_tier_used:input?.price_tier??tier})}
  const units=loadReportModule('../inventory/units/public.ts',{'@/services/api':{apiFetch:async(path,options)=>{const input=JSON.parse(options.body)
    const selected=units.selectProductUnit(product,input.presentation_id,input.price_tier)
    const preview={qty:input.qty,base_qty:units.selectedBaseQuantity(input.qty,selected),unit_metadata_version:2,unit_revision:3,unit_price:selected.unitPrice,line_total:units.selectedLineTotal(input.qty,selected),unit_snapshot:selected.snapshot}
    return preparationHandler?preparationHandler(preview):preview
  }}})
  const Page=loadReportModule(kind==='order'?'../orders/pages/NewOrderPage.tsx':'../quotes/NewQuotePage.tsx',{
    react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},
    '@tanstack/react-query':{useQuery:()=>({data:{unit_prices:{p:999},price_tier_used:tier},isFetching:false,isError:false}),useQueryClient:()=>({invalidateQueries(){}}),useMutation:options=>{mutation=options;return{isPending:false,mutate:()=>options.mutationFn()}}},
    '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},branches:[],registerTenantExitGuard:()=>()=>{}})},
    '@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn()})},
    '@/modules/sales':{SavedCustomerMany2One:()=>null},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:true,locale:'es-GT',currencyCode:'GTQ'})},
    '@/hooks/use-toast':{useToast:()=>({toast:message=>toasts.push(message)})},
    '@/services/productService':{postPricingPreview:price,fetchProductsAvailability:async()=>({p:{available:'100'}})},
    '@/services/quoteService':{createQuote:async payload=>{requests.push(payload);return{id:'Q'}},previewQuoteServiceConditions:async()=>({conditions:{}})},
    '@/services/orderService':{createOrder:async payload=>{requests.push(payload);return{id:'O'}}},
    '@/services/supplierService':{fetchSupplierById:async id=>({id,name:'Cliente'}),adaptApiSupplier:p=>p},
    '@/modules/inventory/units/public':units,'@/services/api':{},'./api':{},
  },nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())}
  const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));render();await new Promise(resolve=>setImmediate(resolve));render()}
  const fields=()=>nodes.filter(n=>n.type?.name==='UnitLineFields')
  const quantities=()=>nodes.filter(n=>n.props['aria-label']==='Cantidad de Producto')
  const pick=()=>{nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(product);render()}
  const save=async()=>{if(kind==='order')await mutation.mutationFn();else{nodes.find(n=>n.props.onClick&&n.props.children?.includes?.('Guardar borrador')).props.onClick();await new Promise(resolve=>setImmediate(resolve))}}
  const total=()=>kind==='quote'?nodes.find(n=>n.type?.name==='QuoteSummary').props.total:nodes.find(n=>n.type==='output').props.children
  render();return{nodes,requests,toasts,pricingRequests,h,render,settle,fields,quantities,pick,save,total,setTier:value=>tier=value,setPricing:fn=>pricingHandler=fn,setPreparation:fn=>preparationHandler=fn}
}
for(const kind of ['order','quote'])test(`actual ${kind} save reconciles an authorized price discrepancy before allowing another submit`,async()=>{
 const f=editor(kind);try{
  await f.settle();f.pick();f.setPreparation(preview=>({...preview,unit_price:'20',line_total:'20.00'}))
  if(kind==='order')await assert.rejects(f.save(),/Revisa el pedido/);else await f.save()
  assert.equal(f.requests.length,0);f.render();assert.equal(f.fields()[0].props.selection.unitPrice,'20')
  await f.save();assert.equal(f.requests.length,1)
 }finally{f.h.unmount()}
})
for(const kind of ['order','quote'])test(`actual ${kind} SERVICE selection emits required billing revision without physical availability`,async()=>{
 const saved=structuredClone(product)
 Object.assign(product,{kind:'SERVICE',stock:0,serviceUnitLabel:'sesión',quantityDecimals:2,unitValues:{...product.unitValues,stock:'0'},unitConfiguration:{...product.unitConfiguration,quantity_decimals:2,default_sale_presentation_id:null,presentations:[],base_unit:{id:'session',code:'SESSION',name:'Sesión',label:'sesión'}}})
 const f=editor(kind);try{
  await f.settle();f.pick();assert.equal(f.fields()[0].props.selection.presentationId,null);f.quantities()[0].props.onChange({target:{value:'1.25'}});f.render()
  await f.save();assert.equal(f.requests.length,1,JSON.stringify(f.toasts));assert.deepEqual(f.requests[0].items[0],{product_id:'p',qty:'1.25',presentation_id:null,unit_revision:3,accept_rounding:false})
 }finally{f.h.unmount();Object.assign(product,saved)}
})
for(const kind of ['order','quote'])test(`real ${kind} selector rejects duplicate identity and edits/saves only the intended quantity`,async()=>{
  const f=editor(kind);try{
    await f.settle();f.pick();f.fields()[0].props.onSelect(null);f.render();f.pick()
    assert.deepEqual(f.fields().map(n=>n.props.selection.presentationId),[null,'box'])
    f.fields()[0].props.onSelect('box');f.render()
    assert.deepEqual(f.fields().map(n=>n.props.selection.presentationId),[null,'box'])
    assert.ok(f.toasts.some(message=>message.variant==='destructive'))
    assert.deepEqual(f.quantities().map(n=>n.props.value),['1','1'])
    f.quantities()[0].props.onChange({target:{value:'2'}});f.render()
    assert.deepEqual(f.quantities().map(n=>n.props.value),['2','1'])
    if(kind==='quote')assert.equal(f.total(),25);else assert.match(f.total(),/25\.00/)
    await f.save();assert.ok(f.requests[0],JSON.stringify(f.toasts))
    assert.deepEqual(f.requests[0].items.map(item=>({qty:item.qty,presentation:item.presentation_id})),[{qty:'2',presentation:null},{qty:'1',presentation:'box'}])
  }finally{f.h.unmount()}
})
for(const kind of ['order','quote'])test(`real ${kind} repricing keeps the displayed selection, row identity and subsequent add synchronized`,async()=>{
  const f=editor(kind);try{
    await f.settle();f.pick()
    if(kind==='quote'){
      f.nodes.find(n=>n.props.id==='manual-tier').props.onCheckedChange(true);f.render()
      f.nodes.find(n=>n.props.value==='WHOLESALE'&&n.props.onValueChange).props.onValueChange('LIST');f.render()
    }else{
      f.setTier('LIST');f.nodes.find(n=>n.type?.name==='SavedCustomerMany2One').props.onPick({id:'customer',name:'Cliente'});f.render()
    }
    await f.settle()
    assert.equal(f.fields()[0].props.selection.priceContext,'LIST')
    assert.equal(f.fields()[0].props.selection.unitPrice,'18')
    f.pick();await f.settle()
    assert.equal(f.fields().length,1)
    assert.equal(f.quantities()[0].props.value,'2')
    if(kind==='quote')assert.equal(f.total(),36);else assert.match(f.total(),/36\.00/)
    await f.save();assert.equal(f.requests[0].items.length,1);assert.equal(f.requests[0].items[0].qty,'2')
  }finally{f.h.unmount()}
})
test('real quote customer repricing updates exact price and identity before another pick/save',async()=>{
  const f=editor('quote');try{
    await f.settle();f.pick();f.setTier('LIST')
    f.nodes.find(n=>n.type?.name==='SavedCustomerMany2One').props.onPick({id:'customer',name:'Cliente'});f.render();await f.settle()
    assert.equal(f.fields()[0].props.selection.priceContext,'LIST');assert.equal(f.fields()[0].props.selection.unitPrice,'18')
    f.pick();await f.settle();assert.equal(f.fields().length,1);assert.equal(f.quantities()[0].props.value,'2');assert.equal(f.total(),36)
    await f.save();assert.equal(f.requests[0].customer_contact_id,'customer');assert.equal(f.requests[0].items.length,1)
  }finally{f.h.unmount()}
})
test('late quote repricing from an older manual tariff cannot overwrite the current price and key',async()=>{
  const f=editor('quote'),pending=[];try{
    await f.settle();f.pick()
    f.setPricing(input=>new Promise(resolve=>pending.push({input,resolve})))
    f.nodes.find(n=>n.props.id==='manual-tier').props.onCheckedChange(true);f.render()
    f.nodes.find(n=>n.props.value==='WHOLESALE'&&n.props.onValueChange).props.onValueChange('LIST');f.render()
    const latest=pending.find(request=>request.input.price_tier==='LIST'),old=pending.find(request=>request.input.price_tier==='WHOLESALE')
    assert.ok(latest);assert.ok(old)
    latest.resolve({unit_prices:{p:999},price_tier_used:'LIST'});await f.settle()
    old.resolve({unit_prices:{p:999},price_tier_used:'WHOLESALE'});await f.settle()
    assert.equal(f.fields()[0].props.selection.priceContext,'LIST');assert.equal(f.fields()[0].props.selection.unitPrice,'18')
    f.pick();await f.settle();assert.equal(f.fields().length,1);assert.equal(f.quantities()[0].props.value,'2');assert.equal(f.total(),36)
  }finally{f.h.unmount()}
})
test('quote collision removal reprices the remaining row once and can edit/save without a tariff dead end',async()=>{
  const f=editor('quote');try{
    await f.settle();f.pick();let resolveList
    f.setPricing(input=>input.price_tier==='LIST'?new Promise(resolve=>resolveList=resolve):({unit_prices:{p:999},price_tier_used:'WHOLESALE'}))
    f.nodes.find(n=>n.props.id==='manual-tier').props.onCheckedChange(true);f.render()
    f.nodes.find(n=>n.props.value==='WHOLESALE'&&n.props.onValueChange).props.onValueChange('LIST');f.render();f.pick()
    assert.deepEqual(f.fields().map(n=>n.props.selection.priceContext),['WHOLESALE','LIST'])
    resolveList({unit_prices:{p:999},price_tier_used:'LIST'});await f.settle()
    assert.deepEqual(f.fields().map(n=>n.props.selection.priceContext),['WHOLESALE','LIST'])
    assert.ok(f.toasts.some(message=>message.description?.includes('Quita el renglón duplicado')))
    f.setPricing(async input=>({unit_prices:{p:999},price_tier_used:input.price_tier}))
    const beforeRemove=f.pricingRequests.length
    f.nodes.filter(n=>n.props['aria-label']==='Quitar Producto')[1].props.onClick();f.render();await f.settle()
    assert.equal(f.fields().length,1);assert.equal(f.fields()[0].props.selection.priceContext,'LIST');assert.equal(f.fields()[0].props.selection.unitPrice,'18')
    assert.equal(f.pricingRequests.length,beforeRemove+1)
    assert.deepEqual(f.pricingRequests.at(-1).product_ids,['p'])
    const afterRecovery=f.pricingRequests.length
    f.quantities()[0].props.onChange({target:{value:'2'}});f.render();await f.settle()
    assert.equal(f.pricingRequests.length,afterRecovery);assert.equal(f.total(),36)
    await f.save();assert.equal(f.requests.length,1);assert.equal(f.requests[0].price_tier,'LIST')
    assert.deepEqual(f.requests[0].items,[{product_id:'p',qty:'2',presentation_id:'box',unit_revision:3,accept_rounding:false}])
    f.render();f.nodes.find(n=>n.props['aria-label']==='Quitar Producto').props.onClick();f.render();await f.settle()
    assert.equal(f.fields().length,0);assert.equal(f.total(),0);assert.equal(f.pricingRequests.length,afterRecovery)
  }finally{f.h.unmount()}
})

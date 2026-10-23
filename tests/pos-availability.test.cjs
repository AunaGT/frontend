const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {QueryClient}=require('@tanstack/react-query'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const scope={companyId:'C',branchId:'B',userId:'U'}
function fixture(failSecond=false){let session='one',requests=[];const file=path.join(__dirname,'../src/modules/sales/hooks/usePosAvailability.ts');const api=fs.existsSync(file)?loadReportModule('../sales/hooks/usePosAvailability.ts',{'@/services/authSession':{authSessionIdentity:()=>session},'@/services/productService':{fetchPosAvailability:async(ids,options)=>{requests.push({ids,options});if(failSecond&&requests.length===2)throw Error('unavailable');return{availability:Object.fromEntries(ids.map(id=>[id,{available:10,location_stock:4}])),salesLocation:{configured:true,id:'L'}}}}}):{};return{api,requests,changeSession:()=>session='two'}}
test('availability query reuses the same IDs, refreshes invalidation and never crosses session or tenant',async()=>{
 const h=fixture(),client=new QueryClient({defaultOptions:{queries:{retry:false}}});assert.equal(typeof h.api.posAvailabilityOptions,'function')
 try{const opts=h.api.posAvailabilityOptions(scope,'L',['p2','p1','p1']);await client.fetchQuery(opts);await client.fetchQuery(h.api.posAvailabilityOptions(scope,'L',['p1','p2']));assert.equal(h.requests.length,1)
 await client.invalidateQueries({queryKey:['products']});await client.fetchQuery(opts);assert.equal(h.requests.length,2)
 await client.fetchQuery(h.api.posAvailabilityOptions({...scope,branchId:'OTHER'},'L',['p1','p2']));assert.equal(h.requests.length,3)
 h.changeSession();await client.fetchQuery(h.api.posAvailabilityOptions(scope,'L',['p1','p2']));assert.equal(h.requests.length,4)
 assert.deepEqual(h.requests[0].options.headers,{'X-Company-Id':'C','X-Branch-Id':'B'})
 const fresh=h.api.posAvailabilityOptions(scope,'L',['p1','p2']);client.setQueryData(fresh.queryKey,{availability:{}},{updatedAt:Date.now()-15001});await client.fetchQuery(fresh);assert.equal(h.requests.length,5)
 }finally{client.clear()}
})
test('more than 200 IDs are bounded batches and a failed batch does not yield a partially fresh result',async()=>{
 const h=fixture(),client=new QueryClient({defaultOptions:{queries:{retry:false}}});assert.equal(typeof h.api.posAvailabilityOptions,'function')
 try{const result=await client.fetchQuery(h.api.posAvailabilityOptions(scope,'L',Array.from({length:201},(_,i)=>'p'+i)));assert.equal(h.requests.length,2);assert.equal(Object.keys(result.availability).length,201);assert.ok(h.requests.every(r=>r.ids.length<=200))}finally{client.clear()}
 const failure=fixture(true),other=new QueryClient({defaultOptions:{queries:{retry:false}}})
 try{await assert.rejects(other.fetchQuery(failure.api.posAvailabilityOptions(scope,'L',Array.from({length:201},(_,i)=>'p'+i))),/unavailable/)}finally{other.clear()}
})
test('real cart demand updates synchronously across rapid additions, not from a stale render closure',()=>{
 const h=require('./helpers/reportHookHarness.cjs').hookHarness(),notices=[]
 const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast:n=>notices.push(n)})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}})
 const product={id:'p',name:'Café',price:5,stock:2},cart=h.render(()=>useCart({availableProducts:[product]}));assert.equal(typeof cart.getBaseQuantity,'function')
 cart.addToCart(product);cart.addToCart(product);cart.addToCart(product)
 const after=h.render(()=>useCart({availableProducts:[product]}));assert.equal(after.getBaseQuantity('p'),'2');assert.equal(after.cartItems[0].qty,'2');assert.equal(after.availabilityDialog.open,true);h.unmount()
})
test('POS adds rapid valid clicks from current availability without loading locations until the counter is short',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),h=require('./helpers/reportHookHarness.cjs').hookHarness()
 const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}})
 const cart=h.render(()=>useCart({availableProducts:[product]}));let locations=0
 const available={availability:{[product.id]:{available:20,stock:20,location_stock:2}},salesLocation:{configured:true,id:'L'}}
 const view=renderPos({realCart:cart,items:[],state:{saleStep:'products'},warehouses:[{locations:[{id:'L',is_sales:true}]}],posAvailability:{availability:available.availability,ensureCurrent:async()=>available},stockLocations:async()=>{locations++;return[{stock:2,location:{id:'L',code:'POS',warehouse:{name:'Mostrador'}}},{stock:18,location:{id:'W',code:'A',warehouse:{name:'Bodega'}}}]}})
 const add=view.nodes.find(n=>n.type?.name==='ProductCard').props.onAdd
 add();add();await new Promise(setImmediate)
 assert.equal(cart.getBaseQuantity?.(product.id),'2');assert.equal(locations,0)
 add();await new Promise(setImmediate)
 assert.equal(locations,1);assert.equal(cart.getBaseQuantity(product.id),'2');assert.ok(view.stateUpdates.elsewhere);h.unmount()
})
test('rapid presentation additions count two boxes of three plus one unit as seven base units',()=>{
 const h=require('./helpers/reportHookHarness.cjs').hookHarness(),{useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}})
 const p={id:'P',name:'Café',kind:'STANDARD',price:1,stock:20,unitValues:{price:'1',cost:'0',stock:'20',minStock:'0',priceWholesale:null,pricePromotion:null},unitConfiguration:{base_unit_id:'U',base_unit:{id:'U',code:'UNIT',name:'Unidad',label:'ud',quantity_decimals:0},quantity_decimals:0,unit_revision:1,presentations:[{id:'box',version:1,name:'Caja',label:'caja',factor:'3',quantity_decimals:0,active:true,sale_enabled:true,purchase_enabled:true,prices:{LIST:'3'}}]}}
 const cart=h.render(()=>useCart({availableProducts:[p]}));cart.addToCart(p,{presentationId:'box'});cart.addToCart(p,{presentationId:'box'});cart.addToCart(p,{presentationId:null});assert.equal(cart.getBaseQuantity('P'),'7');h.unmount()
})
test('an active availability observer refreshes on focus and removes cached stock when POS is unmounted',async()=>{
 const {QueryObserver,focusManager}=require('@tanstack/react-query'),h=fixture(),client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.mount()
 const options=h.api.posAvailabilityOptions(scope,'L',['p']),observer=new QueryObserver(client,options),unsubscribe=observer.subscribe(()=>{})
 try{await observer.refetch();assert.equal(h.requests.length,1);focusManager.setFocused(false);focusManager.setFocused(true);await new Promise(setImmediate);assert.equal(h.requests.length,2)}finally{unsubscribe();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(client.getQueryData(options.queryKey),undefined);client.unmount();client.clear();focusManager.setFocused(undefined)}
})
function realCartFixture(p){
 const h=require('./helpers/reportHookHarness.cjs').hookHarness(),{useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}})
 return{read:()=>h.render(()=>useCart({availableProducts:[p]})),close:()=>h.unmount()}
}
test('pending additions block payment immediately and cannot survive a cleared or replaced cart',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs')
 for(const replace of [false,true]){
  const h=realCartFixture(product);let cart=h.read();cart.addToCart(product);cart=h.read();let release
  const pending=new Promise(resolve=>release=resolve),available={availability:{[product.id]:{available:20,location_stock:20}}}
  const view=renderPos({realCart:cart,state:{saleStep:'products'},warehouses:[{locations:[{id:'L',is_sales:true}]}],posAvailability:{availability:available.availability,ensureCurrent:()=>pending}})
  const add=view.nodes.find(n=>n.type?.name==='ProductCard').props.onAdd;add();await new Promise(setImmediate)
  view.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.onClick();assert.notEqual(view.stateUpdates.saleStep,'payment')
  if(replace)cart.hydrateFromLines([{productId:product.id,qty:'4'}],[]);else cart.clearCart()
  release(available);await new Promise(setImmediate);assert.equal(h.read().cartItems[0]?.qty,replace?'4':undefined);h.close()
 }
})
test('scanner lookup blocks payment before the product is resolved and is discarded after clearing',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),h=realCartFixture(product);let cart=h.read();cart.addToCart(product);cart=h.read();let release
 const view=renderPos({realCart:cart,inventoryUnitsEnabled:true,state:{saleStep:'products',productSearch:'740001'},scanProduct:()=>new Promise(resolve=>release=resolve)})
 view.nodes.find(n=>n.props['aria-label']==='Buscar productos').props.onKeyDown({key:'Enter',preventDefault(){}})
 view.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.onClick();assert.notEqual(view.stateUpdates.saleStep,'payment')
 await new Promise(setImmediate);cart.clearCart();release({product:{...product,available_for_sale:true},presentationId:null});await new Promise(setImmediate);assert.equal(h.read().cartItems.length,0);h.close()
})
test('a rounding presentation reaches the cart for explicit review without approving its rounding',async()=>{
 const {renderPos}=require('./helpers/posPageHarness.cjs'),p={id:'P',name:'Granel',kind:'STANDARD',price:2,stock:20,unitValues:{price:'2',cost:'0',stock:'20',minStock:'0',priceWholesale:null,pricePromotion:null},unitConfiguration:{base_unit_id:'KG',base_unit:{id:'KG',code:'KG',name:'Kilogramo',label:'kg',quantity_decimals:6},quantity_decimals:6,unit_revision:1,default_sale_presentation_id:'lb',presentations:[{id:'lb',version:1,name:'Libra',label:'lb',factor:'0.45359237',quantity_decimals:0,active:true,sale_enabled:true,purchase_enabled:true,prices:{}}]}}
 const h=realCartFixture(p),options={realCart:h.read(),products:[p],items:[],state:{saleStep:'products'},warehouses:[{locations:[{id:'L',is_sales:true}]}],posAvailability:{availability:{P:{available:20,location_stock:20}},ensureCurrent:async()=>({availability:{P:{available:20,location_stock:20}}})}},view=renderPos(options)
 view.nodes.find(n=>n.type?.name==='ProductCard').props.onAdd()
 const choice=renderPos({...options,state:{saleStep:'products',pendingPresentation:view.stateUpdates.pendingPresentation}})
 choice.nodes.find(n=>n.type?.name==='SalePresentationDialog'&&n.props.product).props.onSelect('lb');await new Promise(setImmediate)
 let cart=h.read();assert.equal(cart.cartItems.length,1);assert.equal(cart.cartItems[0].unitSelection.acceptRounding,false);assert.equal(cart.hasInvalidQuantities,true)
 cart.acceptCartRounding(cart.cartItems[0].lineKey,true);cart=h.read();assert.equal(cart.hasInvalidQuantities,false);assert.equal(cart.getBaseQuantity('P'),'0.453592');h.close()
})
test('opening POS does not register hidden sales queries and confirmation invalidates them without a refetch',async()=>{
 const {renderPos}=require('./helpers/posPageHarness.cjs'),view=renderPos()
 assert.equal(view.queryKeys.some(key=>key[0]==='sales'),false)
 await view.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();await new Promise(setImmediate)
 assert.equal(view.writes.length,1);assert.deepEqual(view.invalidations.find(row=>row.queryKey[0]==='sales'),{queryKey:['sales'],refetchType:'none'})
})
test('an old other-warehouse decision cannot add a previous cart product after replacement',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),h=realCartFixture(product),cart=h.read()
 const view=renderPos({realCart:cart,state:{saleStep:'products'},warehouses:[{locations:[{id:'L',is_sales:true}]}],posAvailability:{availability:{},ensureCurrent:async()=>({availability:{[product.id]:{available:20,location_stock:0}}})},stockLocations:async()=>[{stock:20,location:{id:'W',code:'A',warehouse:{name:'Bodega'}}}]})
 view.nodes.find(n=>n.type?.name==='ProductCard').props.onAdd();await new Promise(setImmediate);assert.ok(view.stateUpdates.elsewhere)
 cart.hydrateFromLines([{productId:product.id,qty:'4'}],[])
 const old=renderPos({realCart:h.read(),state:{saleStep:'products',elsewhere:view.stateUpdates.elsewhere}})
 old.nodes.find(n=>n.props.children==='Continuar'&&n.props.onClick).props.onClick();assert.equal(h.read().cartItems[0].qty,'4');h.close()
})

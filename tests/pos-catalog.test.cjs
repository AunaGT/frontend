const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {QueryClient,QueryObserver}=require('@tanstack/react-query'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const file=path.resolve(__dirname,'../src/modules/sales/hooks/usePosCatalog.ts'),scope={companyId:'A',branchId:'B',userId:'U'}
function fixture(network){
 const h=hookHarness(),client=new QueryClient({defaultOptions:{queries:{retry:false}}}),requests=[];let session='S'
 const boundary={apiFetch:async(url,options)=>{requests.push({url,options});return network(url,options)}}
 const service=loadReportModule('../../services/productService.ts',{'@/services/api':boundary,'./api':boundary})
 const queryHooks={useQueryClient:()=>client,useQuery:options=>{const observer=h.hooks.useMemo(()=>new QueryObserver(client,options),[JSON.stringify(options.queryKey)]);observer.setOptions(options);h.hooks.useEffect(()=>observer.subscribe(()=>{}),[observer]);return observer.getCurrentResult()}}
 const api=fs.existsSync(file)?loadReportModule('../sales/hooks/usePosCatalog.ts',{react:h.hooks,'@tanstack/react-query':queryHooks,'@/services/productService':service,'@/services/authSession':{authSessionIdentity:()=>session}}):{}
 return{requests,client,api,read:(s=scope,filters={page:1,pageSize:2,search:'',category:null,catalogType:'goods'})=>{assert.equal(typeof api.usePosCatalog,'function');return h.render(()=>api.usePosCatalog(s,filters,true))},changeSession:()=>session='NEW',close:()=>{h.unmount();client.clear()}}
}
const tick=()=>new Promise(setImmediate),page=(n=1)=>({items:[{id:'P'+n,name:'Café '+n,price:'5',stock:'20',category:{name:'Bebidas'}}],page:n,pageSize:2,totalPages:2,totalItems:3,nextPage:n===1?2:null,prevPage:n===2?1:null})
test('POS loads only one requested page and categories, retaining previous page products for the cart',async()=>{
 const h=fixture(async url=>url.includes('/categories')?{items:[{name:'Bebidas',count:3,image_url:'/bebidas.png'}],totalItems:3}:page(Number(new URL(url,'http://test').searchParams.get('page'))))
 try{h.read();await tick();let state=h.read();assert.equal(h.requests.length,2);assert.equal(state.data.totalItems,3);assert.equal(state.retainedProducts[0].id,'P1');assert.equal(state.categories.data.items[0].image_url,'/bebidas.png')
 h.read(scope,{page:2,pageSize:2,search:'',category:null,catalogType:'goods'});await tick();state=h.read(scope,{page:2,pageSize:2,search:'',category:null,catalogType:'goods'});assert.deepEqual(state.data.items.map(p=>p.id),['P2']);assert.deepEqual(state.retainedProducts.map(p=>p.id).sort(),['P1','P2']);assert.equal(h.requests.filter(r=>!r.url.includes('/categories')).length,2);assert.deepEqual(h.requests[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'})
 }finally{h.close()}
})
test('POS debounces text by300ms but category changes load immediately once search is settled',async()=>{
 const h=fixture(async url=>url.includes('/categories')?{items:[],totalItems:0}:page())
 try{h.read();await tick();for(const search of ['c','ca','caf'])h.read(scope,{page:1,pageSize:2,search,category:null,catalogType:'goods'})
 assert.equal(h.requests.some(r=>r.url.includes('search=')),false);await new Promise(resolve=>setTimeout(resolve,320));h.read(scope,{page:1,pageSize:2,search:'caf',category:null,catalogType:'goods'});await tick();assert.equal(h.requests.filter(r=>r.url.includes('search=caf')).length,2)
 // Category navigation is immediate and text search deliberately spans all categories.
 h.read(scope,{page:1,pageSize:2,search:'caf',category:'Bebidas',catalogType:'goods'});await tick();assert.equal(h.requests.some(r=>r.url.includes('category=Bebidas')),false)
 }finally{h.close()}
})
test('POS ensures201 or more saved product IDs in bounded parallel batches without publishing partial failures',async()=>{
 let active=0,maximum=0,fail=false
 const h=fixture(async(url,options)=>{
  if(options.method==='POST'){active++;maximum=Math.max(maximum,active);await tick();active--;const ids=JSON.parse(options.body).ids;if(fail&&ids.includes('X200'))throw Error('offline');return{items:ids.map(id=>({id,name:id,price:'5',stock:'20'})),missingIds:[]}}
  return url.includes('/categories')?{items:[],totalItems:0}:page()
 })
 try{let state=h.read();await tick();state=h.read();const ids=Array.from({length:401},(_,i)=>'X'+i),result=await state.ensureProducts(ids);assert.equal(result.items.length,401);assert.equal(maximum,2);assert.ok(h.requests.filter(r=>r.options.method==='POST').every(r=>JSON.parse(r.options.body).ids.length<=200));assert.equal(h.read().retainedProducts.length,402)
 fail=true;const previous=h.read().retainedProducts.length;await assert.rejects(state.ensureProducts(['NEW',...ids]),/offline/);assert.equal(h.read().retainedProducts.length,previous)
 }finally{h.close()}
})
test('a late response cannot populate the next tenant or session catalog',async()=>{
 let release
 const h=fixture(async(url,options)=>url.includes('/categories')?{items:[],totalItems:0}:options.headers['X-Branch-Id']==='B'?new Promise(resolve=>release=resolve):{...page(),items:[{id:'NEW',name:'Nuevo',price:'3',stock:'2'}]})
 try{h.read();h.read({...scope,branchId:'OTHER'});await tick();release(page());await tick();let state=h.read({...scope,branchId:'OTHER'});assert.deepEqual(state.retainedProducts.map(p=>p.id),['NEW']);h.changeSession();state=h.read({...scope,branchId:'OTHER'});assert.equal(state.retainedProducts.length,0)}finally{h.close()}
})
test('draft hydration can use explicitly fetched products before React renders the new page',()=>{
 const h=hookHarness(),{useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}}),cart=h.render(()=>useCart({availableProducts:[]}))
 const result=cart.hydrateFromLines([{productId:'OFFPAGE',qty:'2'}],[],[{id:'OFFPAGE',name:'Fuera de página',price:5,stock:20}]);assert.deepEqual(result.missingProductIds,[]);assert.equal(h.render(()=>useCart({availableProducts:[]})).cartItems[0].qty,'2');h.unmount()
})
test('a fresh ensured product is not overwritten by the older current page response',async()=>{
 const h=fixture(async(url,options)=>options.method==='POST'?{items:[{id:'P1',name:'Nuevo precio',price:'11',stock:'20'}],missingIds:[]}:url.includes('/categories')?{items:[],totalItems:0}:page())
 try{h.read();await tick();const before=h.read();await before.ensureProducts(['P1']);assert.equal(h.read().retainedProducts.find(p=>p.id==='P1').price,11)}finally{h.close()}
})
test('order recovery followed by a fresh page makes the new unit revision available to the cart',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),old={...product,price:5,unitConfiguration:{unit_revision:1}},fresh={...product,price:11,unitConfiguration:{unit_revision:2}},order={id:'O',status:'CONFIRMED',fulfillment_mode:'LEGACY',lines:[{id:'L',product_id:product.id,item_kind:'STANDARD',qty:'2',qty_fulfilled:'0',unit_price:'5',line_total:'10'}]}
 const catalog={data:{...page(),items:[]},retainedProducts:[],isSuccess:true,categories:{data:{items:[]}},ensureProducts:async()=>({items:[old],missingIds:[]})}
 const recovery=renderPos({state:{saleStep:'products',loadOrderRef:'O',loadOrderOpen:true},permissions:['sales.create','orders.view'],enabledModules:['orders'],loadOrder:async()=>order,catalog})
 recovery.nodes.find(n=>n.props.children==='Cargar'&&n.props.onClick).props.onClick();await tick();assert.equal(recovery.stateUpdates.loadedOrder.id,'O')
 const updated=renderPos({state:{saleStep:'products',scannedProducts:recovery.stateUpdates.scannedProducts??[],loadedOrder:order},catalog:{...catalog,data:{...page(),items:[fresh]},retainedProducts:[fresh]}})
 const current=updated.cartOptions.at(-1).availableProducts.find(p=>p.id===product.id)
 assert.equal(current.unitConfiguration.unit_revision,2);assert.equal(current.price,11)
})
test('backend POS projections are accepted by the real frontend unit adapter for versions1 and2',async()=>{
 const backend=path.resolve(__dirname,'../../deposito-backend'),{withMocks}=require(path.join(backend,'tests/helpers/reportHarness.cjs')),tenant=require.resolve(path.join(backend,'src/middlewares/tenant.js'))
 const {adaptApiProduct}=loadReportModule('../../services/productService.ts',{'./api':{}}),id='00000000-0000-4000-8000-000000000001',baseId='00000000-0000-4000-8000-000000000002'
 await withMocks({[tenant]:{hasPerm:(user,code)=>user.permissions.includes(code)}},path.join(backend,'src/modules/inventory/posCatalog.js'),async api=>{
  for(const version of [1,2]){
   const row={id,name:'Harina',base_unit_id:baseId,unit_metadata_version:version,unit_revision:3,quantity_decimals:3,kind:'STANDARD',price:'5.25',stock:'7.125',min_stock:'0.1',category:{id:1,name:'Alimentos'}},db={product:{count:async()=>1,findMany:async({select})=>[Object.fromEntries(Object.keys(select).map(key=>[key,row[key]]))]},productStock:{findMany:async()=>[{product_id:id,stock:'7.125',min_stock:'0.1'}]},systemSetting:{findUnique:async()=>({value:'true'})},measureUnit:{findMany:async()=>[{id:baseId,name:'Kilogramo',label:'kg',factor:'1',quantity_decimals:3}]},productPresentation:{findMany:async()=>[]},productBarcode:{findMany:async()=>[]}},s={companyId:'A',branchId:'B',user:{permissions:['sales.create']}}
   const responses=[(await api.listPosCatalog(db,s,{})).items[0],(await api.posCatalogItems(db,s,{ids:[id]})).items[0],(await api.resolvePosCode(db,s,{code:'00123'})).item]
   for(const response of responses){const product=adaptApiProduct(response);assert.equal(product.stock,7.125);assert.equal(Boolean(product.unitConfiguration),version===2);if(version===2){assert.equal(product.unitConfiguration.unit_revision,3);assert.equal(product.unitValues.stock,'7.125')}}
  }
 })
})
test('the POS view renders the returned server page, not a local slice of retained cart products',()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),outside={...product,id:'OFF',name:'Fuera de página'},visible={...product,id:'VISIBLE',name:'Página dos'}
 const catalog={data:{items:[visible],page:2,pageSize:40,totalPages:9,totalItems:350},retainedProducts:[outside,visible],isSuccess:true,isLoading:false,isFetching:false,isError:false,categories:{data:{items:[{name:'Bebidas',count:350,image_url:'/bebidas.png'}]},isError:false,refetch(){}},ensureProducts:async()=>({items:[],missingIds:[]})}
 const view=renderPos({products:[outside],catalog,state:{saleStep:'products',productPage:2}})
 assert.deepEqual(view.nodes.filter(n=>n.type?.name==='ProductCard').map(n=>n.props.product.id),['VISIBLE']);assert.equal(view.nodes.find(n=>n.type?.name==='Pagination').props.totalItems,350);assert.equal(view.nodes.find(n=>n.type?.name==='CategoryBrowseCard').props.imageUrl,'/bebidas.png')
})
test('POS price preparation is bounded to200 per request and does not accept incomplete or mixed-tier results',async()=>{
 let fail=false,active=0,maximum=0
 const h=fixture(async(url,options)=>{if(!url.includes('pricing-preview'))return url.includes('/categories')?{items:[],totalItems:0}:page();const ids=JSON.parse(options.body).product_ids;assert.ok(ids.length<=200);active++;maximum=Math.max(maximum,active);await tick();active--;return{price_tier_used:fail&&ids.includes('X200')?'WHOLESALE':'LIST',unit_prices:Object.fromEntries(ids.map(id=>[id,5]))}})
 try{assert.equal(typeof h.api.preparePosPrices,'function');const prices=await h.api.preparePosPrices(scope,Array.from({length:401},(_,i)=>'X'+i),'POS',null);assert.equal(Object.keys(prices.unit_prices).length,401);assert.equal(maximum,2);fail=true;await assert.rejects(h.api.preparePosPrices(scope,Array.from({length:401},(_,i)=>'X'+i),'POS',null),/tarifa|precios/i)}finally{h.close()}
})
for(const offline of [false,true])test(`saved POS cart resolves off-page products before replacing the current cart (${offline?'offline':'online'})`,async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),h=hookHarness(),{useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}}),cart=()=>h.render(()=>useCart({availableProducts:[product]})),previous=global.localStorage,values=new Map(),off={...product,id:'OFF',name:'Guardado'}
 global.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
 values.set('deposito:new-sale-draft:v2:["A","B","user"]',JSON.stringify({v:2,savedAt:'2026-10-21',customer:'Cliente guardado',isFinalConsumer:true,paymentMethodId:null,lines:[{productId:'OFF',qty:'2'}]}))
 try{cart().addToCart(product);let requests=0
  const catalog={data:{items:[product],page:1,pageSize:40,totalItems:1,totalPages:1},retainedProducts:[product],isSuccess:true,isLoading:false,isError:false,categories:{data:{items:[]},isError:false},ensureProducts:async ids=>{requests++;assert.deepEqual(ids,['OFF']);if(offline)throw Error('offline');return{items:[off],missingIds:[]}}}
  const view=renderPos({catalog,realCart:cart(),state:{saleStep:'products',hasStoredDraft:true}});view.nodes.find(n=>n.props.children==='Recuperar venta guardada').props.onClick();await tick()
  assert.equal(requests,1);assert.equal(cart().cartItems[0].id,offline?product.id:'OFF');if(offline)assert.equal(view.stateUpdates.customer,undefined);assert.ok(values.has('deposito:new-sale-draft:v2:["A","B","user"]'))
 }finally{global.localStorage=previous;h.unmount()}
})
test('POS category failures offer retry rather than implying there are no categories',()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),view=renderPos({state:{saleStep:'products'},catalog:{data:{...page(),items:[product]},retainedProducts:[product],categories:{isError:true,isFetching:false,refetch(){}},isSuccess:true,isLoading:false}})
 assert.match(view.html,/No se pudieron cargar las categorías/);assert.match(view.html,/Reintentar categorías/)
})
test('pricing only prepares visible and cart IDs, not every retained visited product',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),visible={...product,id:'VISIBLE'},cart={...product,id:'CART',qty:'1'},unused={...product,id:'UNUSED'}
 const view=renderPos({items:[cart],catalog:{data:{...page(),items:[visible]},retainedProducts:[unused,visible,cart],categories:{data:{items:[]}},isSuccess:true}})
 const effect=view.effects.find(e=>Array.isArray(e.deps?.[0])&&e.deps[1]==='POS');assert.ok(effect);const cleanup=effect.run();await tick();assert.deepEqual(view.priceRequests[0].sort(),['CART','VISIBLE']);cleanup?.()
})
for(const missing of [false,true])test(`loading an off-page physical order resolves all required lines (${missing?'missing':'present'})`,async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),order={id:'O',status:'CONFIRMED',fulfillment_mode:'LEGACY',is_final_consumer:true,lines:[{id:'L',product_id:'OFF',item_kind:'STANDARD',qty:'2',qty_fulfilled:'0',unit_price:'5',line_total:'10'}]},calls=[]
 const view=renderPos({state:{saleStep:'products',loadOrderOpen:true,loadOrderRef:'O'},permissions:['sales.create','orders.view'],enabledModules:['orders'],loadOrder:async()=>order,catalog:{data:{...page(),items:[product]},retainedProducts:[product],isSuccess:true,categories:{data:{items:[]}},ensureProducts:async ids=>{calls.push(ids);return{items:missing?[]:[{...product,id:'OFF'}],missingIds:missing?['OFF']:[]}}}})
 view.nodes.find(n=>n.props.children==='Cargar'&&n.props.onClick).props.onClick();await tick();assert.deepEqual(calls,[['OFF']]);assert.equal(view.stateUpdates.loadedOrder?.id,missing?undefined:'O');if(missing)assert.match(view.notifications.at(-1).description,/todos los productos/)
})
test('legacy Enter resolves an off-page code and blocks payment while awaiting its lookup',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),h=hookHarness(),{useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}}),read=()=>h.render(()=>useCart({availableProducts:[product]}));let release,code
 read().addToCart(product)
 const off={...product,id:'OFF',barcode:'0001',kind:'SERVICE',service_unit_label:'Hora',quantity_decimals:0},view=renderPos({realCart:read(),state:{saleStep:'products',productSearch:'0001'},resolveCode:async(_scope,value)=>{code=value;return new Promise(resolve=>release=resolve)}})
 view.nodes.find(n=>n.props['aria-label']==='Buscar productos').props.onKeyDown({key:'Enter',preventDefault(){}});view.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.onClick();assert.notEqual(view.stateUpdates.saleStep,'payment');await tick();release({item:off});await tick();assert.equal(code,'0001');assert.equal(read().cartItems.some(p=>p.id==='OFF'),true);h.unmount()
})
test('loading a cart disables new additions until all requested order products are resolved',async()=>{
 const {renderPos,product}=require('./helpers/posPageHarness.cjs'),h=hookHarness(),{useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}}),read=()=>h.render(()=>useCart({availableProducts:[product]}));let release
 read().addToCart(product);const order={id:'O',status:'CONFIRMED',fulfillment_mode:'LEGACY',lines:[{id:'L',product_id:product.id,item_kind:'STANDARD',qty:'2',qty_fulfilled:'0',unit_price:'5',line_total:'10'}]}
 const view=renderPos({realCart:read(),state:{saleStep:'products',loadOrderOpen:true,loadOrderRef:'O'},enabledModules:['orders'],permissions:['sales.create','orders.view'],loadOrder:async()=>order,warehouses:[{locations:[{id:'L',is_sales:true}]}],posAvailability:{availability:{},ensureCurrent:async()=>({availability:{[product.id]:{available:20,location_stock:20}}})},catalog:{data:{...page(),items:[product]},retainedProducts:[product],isSuccess:true,categories:{data:{items:[]}},ensureProducts:()=>new Promise(resolve=>release=resolve)}})
 view.nodes.find(n=>n.props.children==='Cargar'&&n.props.onClick).props.onClick();await tick();view.nodes.find(n=>n.type?.name==='ProductCard').props.onAdd();await tick();assert.equal(read().getBaseQuantity(product.id),'1');release({items:[product],missingIds:[]});await tick();assert.equal(view.stateUpdates.loadedOrder.id,'O');h.unmount()
})

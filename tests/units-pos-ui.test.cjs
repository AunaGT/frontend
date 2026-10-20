const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const product={id:'p',name:'Producto',kind:'STANDARD',price:999,stock:999,unitValues:{price:'6',cost:'2',stock:'9',minStock:'0',priceWholesale:null,pricePromotion:null},unitConfiguration:{base_unit_id:'unit',base_unit:{id:'unit',code:'UNIT',name:'Unidad',label:'unidades',quantity_decimals:0},quantity_decimals:0,unit_revision:3,default_sale_presentation_id:null,presentations:[{id:'box',version:2,name:'Caja',label:'caja',factor:'3',quantity_decimals:0,active:true,sale_enabled:true,purchase_enabled:true,prices:{LIST:'19.5'}}]}}
function cart(){const states=[];let cursor=0;const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:{...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useCallback:fn=>fn},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}});return()=>{cursor=0;return useCart({availableProducts:[product]})}}
test('exact tariff selection follows positive base fallback, expiration and explicit zero presentation overrides',()=>{
 const {selectProductUnit}=loadReportModule('../inventory/units/selection.ts'),p=structuredClone(product)
 p.unitValues={...p.unitValues,price:'10',priceWholesale:'0',pricePromotion:'5'};p.promotionValidUntil='2020-01-01'
 p.unitConfiguration.presentations[0]={...p.unitConfiguration.presentations[0],factor:'2',promotion_valid_until:'2020-01-01',prices:{PROMOTION:'3'}}
 assert.equal(selectProductUnit(p,null,'WHOLESALE').unitPrice,'10')
 assert.equal(selectProductUnit(p,'box','PROMOTION').unitPrice,'20')
 p.unitConfiguration.presentations[0].promotion_valid_until='2099-01-01';p.unitConfiguration.presentations[0].prices.PROMOTION='0'
 assert.equal(selectProductUnit(p,'box','PROMOTION').unitPrice,'0')
})
test('actual cart preparation reconciles an authorized price and requires another review action',()=>{
 const render=cart();render().addToCart(product,{presentationId:'box'});const line=render().cartItems[0]
 const preview={qty:'1',base_qty:'3',unit_metadata_version:2,unit_revision:3,unit_price:'20',line_total:'20.00',unit_snapshot:line.unitSelection.snapshot}
 assert.equal(render().reconcileUnitPreparation(line.lineKey,preview),true)
 assert.equal(render().cartTotalExact,'20.00');assert.equal(render().reconcileUnitPreparation(line.lineKey,preview),false)
})
test('configured service keeps the v2 revision in real cart callbacks without checking physical availability',()=>{
 const saved=structuredClone(product)
 try{Object.assign(product,{kind:'SERVICE',stock:0,serviceUnitLabel:'sesión',quantityDecimals:2,unitValues:{...product.unitValues,stock:'0'},unitConfiguration:{...product.unitConfiguration,quantity_decimals:2,presentations:[],base_unit:{id:'session',code:'SESSION',name:'Sesión',label:'sesión'},default_sale_presentation_id:null}})
 const render=cart();render().addToCart(product);assert.equal(render().cartItems.length,1)
 const line=render().cartItems[0];assert.ok(line.unitSelection);render().updateQuantity(line.lineKey,'1.25')
 assert.equal(render().cartItems[0].qty,'1.25');assert.equal(render().availabilityDialog.open,false)
 assert.deepEqual(loadReportModule('../inventory/units/selection.ts').selectedUnitPayload(line.unitSelection),{presentation_id:null,unit_revision:3,accept_rounding:false})
 }finally{Object.assign(product,saved)}
})
test('real SERVICE configuration and DTO survive client cart and direct Agenda metadata into server resolution',async()=>{
 const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),file=path.resolve(__dirname,'../../deposito-backend/tests/units.catalog.test.js')
 const source=fs.readFileSync(file,'utf8').split("test('legacy product opt-in")[0],fixture=new Module(file,module);fixture.filename=file;fixture.paths=Module._nodeModulePaths(path.dirname(file));fixture._compile(source,file)
 const {database,scope}=fixture.exports,{db,state}=database(),Units=require('../../deposito-backend/src/modules/inventory/units')
 Object.assign(state.product,{kind:'SERVICE',base_unit_id:null,unit_metadata_version:1,quantity_decimals:0,stock:'0',service_unit_label:'sesión',cost:'0'})
 state.units=[{id:'session',company_id:'A',code:'SESSION',family:'SESSION',name:'Sesión',label:'sesión',factor:'1',quantity_decimals:4,active:true}]
 db.systemSetting.findUnique=async({where})=>({key:where.company_id_key.key,value:'true'});db.stockMovement.createMany=async()=>assert.fail('No SERVICE stock movement')
 await Units.configureProduct(db,scope,'P',{base_unit_id:'session',quantity_decimals:2,unit_revision:1})
 const [raw]=await Units.extendProductDTO(db,scope,[state.product])
 const mapped=loadReportModule('../../services/productService.ts',{'./api':{}}).adaptApiProduct(raw),saved=structuredClone(product)
 try{
  Object.assign(product,mapped);const render=cart();render().addToCart(product);const line=render().cartItems[0];assert.ok(line.unitSelection)
  const selection=loadReportModule('../inventory/units/selection.ts'),payload={qty:'1.25',...selection.selectedUnitPayload(line.unitSelection)}
  const resolved=await Units.resolveUnitLine(db,{...scope,permissions:['sales.create']},state.product,payload)
  assert.equal(resolved.unit_metadata_version,2);assert.equal(resolved.unit_label,'sesión');assert.equal(resolved.base_qty,'1.25');assert.equal(state.product.stock,'0')
  const api=loadReportModule('../appointments/commercialApi.ts',{'./api':{}}),id='00000000-0000-4000-8000-000000000001'
  const direct=api.directServiceEngagementLine({...mapped,id},'1.25')
  const parsed=require('../../deposito-backend/src/modules/appointments/engagements').parseEngagement({contactId:id,idempotencyKey:'service-direct',lines:[direct]})
  assert.deepEqual(parsed.lines,[{productId:id,quantity:'1.25',unitRevision:2,presentationId:null,acceptRounding:false}])
  const legacy=api.directServiceEngagementLine({...mapped,unitConfiguration:undefined},'1.25');assert.deepEqual(legacy,{productId:mapped.id,quantity:'1.25'})
 }finally{Object.assign(product,saved)}
})
test('changing a cart presentation cannot create a duplicate line identity or exceed aggregate base availability',()=>{
  const render=cart();render().addToCart(product,{presentationId:'box'});render().addToCart(product,{presentationId:null})
  let c=render(),base=c.cartItems.find(l=>l.unitSelection.presentationId===null);c.selectCartUnit(base.lineKey,'box');c=render()
  assert.equal(new Set(c.cartItems.map(l=>l.lineKey)).size,2)
  c.removeFromCart(c.cartItems.find(l=>l.unitSelection.presentationId==='box').lineKey);c=render();base=c.cartItems[0];c.updateQuantity(base.lineKey,'4');render().selectCartUnit(base.lineKey,'box')
  assert.equal(render().cartItems[0].unitSelection.presentationId,null)
})
test('real cart callbacks preserve box/base identity, price 57 and aggregate nine base units',()=>{const render=cart();render().addToCart(product,{presentationId:'box'});render().addToCart(product,{presentationId:null});let c=render();assert.equal(c.cartItems.length,2);const box=c.cartItems.find(l=>l.unitSelection?.presentationId==='box'),base=c.cartItems.find(l=>l.unitSelection?.presentationId===null);assert.ok(box);assert.ok(base);c.updateQuantity(box.lineKey,'2');render().updateQuantity(base.lineKey,'3');c=render();assert.equal(c.cartTotalExact,'57.00');assert.equal(c.baseQuantities.p,'9');c.updateQuantity(base.lineKey,'4');assert.equal(render().cartItems.find(l=>l.lineKey===base.lineKey).qty,'3');assert.equal(render().availabilityDialog.open,true)})
test('old ambiguous advanced draft stays review-required rather than silently selecting base',()=>{const render=cart();const restored=render().hydrateFromLines([{productId:'p',qty:'2'}],[]);assert.deepEqual(restored.unitReviewIds,['p']);assert.equal(render().hasInvalidQuantities,true)})
test('versioned draft recovery preserves exact selected price and archived snapshot for review',()=>{const render=cart();render().addToCart(product,{presentationId:'box'});const saved=render().cartItems[0];render().clearCart();render().hydrateFromLines([{productId:'p',qty:'2',unitSelection:saved.unitSelection,lineKey:saved.lineKey}],[]);assert.equal(render().cartItems[0].unitSelection.unitPrice,'19.5');assert.equal(render().cartItems[0].unitSelection.snapshot.factor,'3')})
test('stored POS drafts retain v2 exact selected metadata and still expose old drafts for review',()=>{const values=new Map(),old=global.localStorage;global.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};try{const {saveNewSaleDraft,loadNewSaleDraft}=loadReportModule('../../services/saleDraftStorage.ts');const render=cart();render().addToCart(product,{presentationId:'box'});const line=render().cartItems[0];const scope={companyId:'A',branchId:'B'};saveNewSaleDraft('U',{lines:[{productId:'p',qty:'0.123456',unitSelection:line.unitSelection}]},scope);assert.equal(loadNewSaleDraft('U',scope).v,2);assert.equal(loadNewSaleDraft('U',scope).lines[0].unitSelection.unitPrice,'19.5');const key=[...values.keys()][0];values.set(key,JSON.stringify({v:1,savedAt:'old',lines:[{productId:'p',qty:1}]}));assert.equal(loadNewSaleDraft('U',scope).v,1)}finally{global.localStorage=old}})
test('checkout attempt persists a frozen v2 exact request before the first network call',async()=>{const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},scope={companyId:'A',branchId:'B',userId:'U'};const {createCheckoutFlow}=loadReportModule('../sales/checkout/checkoutFlow.ts');let saved;const flow=createCheckoutFlow({scope,storage,isCurrent:()=>true,newKey:()=> 'key',withLock:async fn=>fn(),submit:async()=>{saved=JSON.parse([...values.values()][0]);throw Error('network')},lookup:async()=>{throw Object.assign(Error('pending'),{status:404})},onState(){},onConfirmed(){}});const payload={items:[{product_id:'p',qty:'0.123456',presentation_id:'box',unit_revision:3,price:'0.123456789012345678'}]};await flow.submit('SALE',payload);assert.equal(saved.version,2);assert.deepEqual(saved.payload,payload);payload.items[0].qty='9';assert.equal(JSON.parse([...values.values()][0]).payload.items[0].qty,'0.123456')})
test('box scanner resolves scoped server code before loading the product and retains revision',async()=>{const calls=[];const {lookupScannedUnitProduct}=loadReportModule('../../services/scannerService.ts',{'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:async(path,options)=>{calls.push({path,options});return path.includes('/barcodes/resolve')?{product_id:'p',presentation_id:'box',unit_revision:3}:{id:'p',unit_revision:3}}}});const controller=new AbortController();const result=await lookupScannedUnitProduct({companyId:'A',branchId:'B',canViewProducts:true,inventoryEnabled:true},'00123',{signal:controller.signal});assert.equal(result.presentationId,'box');assert.equal(result.unitRevision,3);assert.match(calls[0].path,/barcodes\/resolve\?code=00123/);assert.equal(calls[1].path,'/api/products/p');assert.equal(calls[1].options.signal,controller.signal);assert.deepEqual(calls[1].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'})})
test('approved box7 order recovers four remaining BASE units at frozen net 5.71 despite current box3',()=>{const {frozenDocumentSelection}=loadReportModule('../inventory/units/public.ts',{'@/services/api':{}});const source={id:'L',qty:'1',unit_price:'10',line_total:'10.00',unit_metadata_version:2,base_qty:'7',base_fulfilled:'3',unit_snapshot:{version:2,baseUnit:{id:'u',code:'UNIT',label:'unidades',decimals:0},presentation:{id:'archived',version:1,label:'caja',decimals:0},factor:'7',roundingDelta:'0'}};const selected=frozenDocumentSelection(source,'BASE');const render=cart();render().hydrateFromLines([{productId:'p',qty:'4',unitSelection:selected}],[]);assert.equal(render().hasInvalidQuantities,false);assert.equal(render().baseQuantities.p,'4');assert.equal(render().cartTotalExact,'5.71');assert.equal(render().cartItems[0].unitSelection.sourceUnitPrice,'10');assert.equal(render().cartItems[0].unitSelection.sourceLineId,'L')})
test('catalog revision refresh keeps the selected snapshot and requires explicit review',()=>{const render=cart(),config=product.unitConfiguration;render().addToCart(product,{presentationId:'box'});try{product.unitConfiguration={...config,unit_revision:4,presentations:[{...config.presentations[0],factor:'4'}]};render().repriceCartLines();assert.equal(render().cartItems[0].unitSelection.snapshot.factor,'3');assert.equal(render().cartItems[0].unitSelection.revision,3);assert.equal(render().hasInvalidQuantities,true)}finally{product.unitConfiguration=config}})

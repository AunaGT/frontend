const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')
const unit={id:'unit',company_id:'company',code:'UNIT',family:'COUNT',name:'Unidad',label:'unidades',factor:'1',quantity_decimals:0,active:true}
const draft=()=>({baseUnitId:'unit',quantityDecimals:'0',presentations:[{key:'box',name:'Caja',label:'caja',factor:'24',quantityDecimals:'0',purchaseEnabled:true,saleEnabled:true,price:'',wholesale:'',promotion:'',promotionUntil:'',barcode:'',measureUnitId:null}],defaultPurchaseKey:'box',defaultSaleKey:null})
test('backfilled legacy UNIT maps without advanced checkout selection and incomplete metadata is rejected',()=>{
  const {adaptApiProduct}=loadReportModule('../../services/productService.ts',{'./api':{}})
  const selection=loadReportModule('../inventory/units/selection.ts')
  const raw={id:'legacy',name:'Legacy',base_unit_id:'unit',base_unit:unit,unit_metadata_version:1,quantity_decimals:0,unit_revision:1,stock:'12',price:'7',cost:'5'}
  const product=adaptApiProduct(raw)
  assert.equal(product.unitConfiguration,undefined)
  assert.equal(product.baseUnitConfiguration.base_unit_id,'unit')
  assert.equal(selection.selectProductUnit(product),undefined)
  assert.throws(()=>adaptApiProduct({...raw,unit_metadata_version:undefined}),/unidad/i)
})
const text=children=>React.Children.toArray(children).map(c=>typeof c==='object'?text(c.props.children):String(c)).join(' ')
function fields(options={}){
  const h=hookHarness(),nodes=[],saved=[];let value=draft()
  const {UnitSettingsFields}=loadReportModule('../inventory/units/UnitSettingsFields.tsx',{react:h.hooks},nodes)
  const render=()=>{nodes.length=0;return h.render(()=>UnitSettingsFields({enabled:true,kind:'STANDARD',units:[unit],value,onChange:v=>value=v,onSavePresentation:async row=>saved.push(row),...options}))}
  render();return {nodes,render,saved,get value(){return value},unmount:h.unmount}
}
test('feature-off product retains a plain unit explanation and no presentation actions',()=>{
  const f=fields({enabled:false});try{assert.ok(f.nodes.some(n=>text(n.props.children).includes('cantidades enteras')));assert.ok(!f.nodes.some(n=>n.props.onClick||n.props.onValueChange))}finally{f.unmount()}
})
test('goods use base/purchase/sale sections with exact live equivalence and preserve incomplete draft',()=>{
  const f=fields();try{
    for(const label of ['Cómo controlás tus existencias','Cómo lo comprás','Cómo lo vendés'])assert.ok(f.nodes.some(n=>text(n.props.children).includes(label)))
    assert.ok(f.nodes.some(n=>text(n.props.children).includes('48 unidades')))
    f.nodes.find(n=>n.props.id==='presentation-factor-box').props.onChange({target:{value:'1,'}});f.render()
    assert.equal(f.value.presentations[0].factor,'1,')
    assert.ok(!f.nodes.some(n=>n.props.role==='tab'))
  }finally{f.unmount()}
})
test('read-only and locked bases cannot mutate through captured callbacks',async()=>{
  const f=fields({disabled:true,baseLocked:true});try{
    for(const n of f.nodes.filter(n=>n.props.onChange))n.props.onChange({target:{value:'99'}})
    for(const n of f.nodes.filter(n=>n.props.onValueChange))n.props.onValueChange('foreign')
    for(const n of f.nodes.filter(n=>n.props.onClick))await n.props.onClick()
    assert.deepEqual(f.value,draft());assert.equal(f.saved.length,0)
  }finally{f.unmount()}
  const locked=fields({baseLocked:true});try{assert.equal(locked.nodes.find(n=>n.props.id==='product-base-unit').props.disabled,true);assert.ok(locked.nodes.some(n=>text(n.props.children).includes('historial')))}finally{locked.unmount()}
})
test('services offer billing base and precision without purchase or stock controls',()=>{
  const f=fields({kind:'SERVICE'});try{assert.ok(f.nodes.some(n=>text(n.props.children).includes('Unidad de cobro')));assert.ok(f.nodes.some(n=>n.props.id==='product-base-unit'));assert.ok(!f.nodes.some(n=>text(n.props.children)==='Cómo lo comprás'));assert.ok(!f.nodes.some(n=>n.props.id==='product-purchase-unit'))}finally{f.unmount()}
})
test('read-only goods show base, purchase, sale and presentation equivalences without form controls',()=>{
  const f=fields({readOnly:true});try{
    const labels=f.nodes.filter(n=>n.type==='dd').map(n=>text(n.props.children))
    assert.ok(labels.some(v=>v.includes('Unidad')&&v.includes('unidades')))
    assert.ok(labels.includes('Caja'))
    assert.ok(f.nodes.some(n=>/24\s+unidades/.test(text(n.props.children))))
    assert.equal(f.nodes.some(n=>n.props.onChange||n.props.onValueChange||n.props.onClick),false)
    assert.equal(f.nodes.some(n=>n.props.id==='unit-example-quantity'),false)
  }finally{f.unmount()}
})
test('read-only service shows billing information without physical inventory fields or editable controls',()=>{
  const f=fields({kind:'SERVICE',readOnly:true});try{
    assert.ok(f.nodes.some(n=>n.type==='dt'&&text(n.props.children)==='Unidad de cobro'))
    assert.equal(f.nodes.some(n=>n.props.onChange||n.props.onValueChange||n.props.onClick),false)
    assert.equal(f.nodes.some(n=>text(n.props.children)==='Compra habitual'),false)
  }finally{f.unmount()}
})
test('read-only presentation retains its own prices, precision, measure and version without needing edit permission',()=>{
  const f=fields({readOnly:true,basePrice:'5',value:{...draft(),presentations:[{...draft().presentations[0],price:'100',wholesale:'90',promotion:'80',promotionUntil:'2026-10-21T12:00',quantityDecimals:'2',version:3,measureUnitId:'unit'}]}})
  try{
    const values=f.nodes.filter(n=>n.type==='dd').map(n=>text(n.props.children))
    for(const expected of ['100','90','80','2','3','Unidad'])assert.ok(values.includes(expected),expected)
    assert.ok(values.some(v=>v.includes('2026')))
    assert.equal(f.nodes.some(n=>n.props.onChange||n.props.onValueChange||n.props.onClick),false)
  }finally{f.unmount()}
})
test('free-label service does not invent a zero precision from an absent unit configuration',()=>{
  const f=fields({readOnly:true,kind:'SERVICE',value:{...draft(),baseUnitId:'',quantityDecimals:'0',presentations:[]}})
  try{assert.equal(f.nodes.some(n=>n.type==='dt'&&text(n.props.children)==='Decimales de cobro'),false)}finally{f.unmount()}
})
test('presentation save validates the current draft and exposes a factor revision as a new version',async()=>{
  const f=fields({value:{...draft(),presentations:[{...draft().presentations[0],id:'old',version:1}]}})
  try{const action=f.nodes.find(n=>n.props.children==='Guardar nueva versión');assert.ok(action);await action.props.onClick();assert.equal(f.saved[0].id,'old');assert.equal(f.saved[0].factor,'24')}finally{f.unmount()}
})
test('product mapping retains authoritative six-place strings while the create payload uses exact input',()=>{
  const {adaptApiProduct}=loadReportModule('../../services/productService.ts',{'./api':{}})
  const model=loadReportModule('../inventory/units/model.ts')
  const product=adaptApiProduct({id:'p',name:'Peso',unit_metadata_version:2,base_unit_id:'kg',base_unit:{...unit,id:'kg',quantity_decimals:6},quantity_decimals:3,unit_revision:4,stock:'99999999.999999',min_stock:'0.000001',price:'0.000001',cost:'12345678.123456789012',presentations:[]})
  assert.equal(model.exactProductValues(product).stock,'99999999.999999')
  assert.equal(model.exactProductValues(product).cost,'12345678.123456789012')
  assert.equal(product.unitConfiguration.quantity_decimals,3)
  const payload=model.productDecimalPayload({price:'0,000001',stock:'0,123456',cost:'1,123456'},{kind:'STANDARD',quantityDecimals:6,advanced:true})
  assert.equal(payload.stock,'0.123456');assert.equal(payload.price,'0.000001');assert.equal(payload.cost,'1.123456')
  assert.equal(model.initialUnitsConfiguration(draft(),'STANDARD').default_purchase_key,'box')
})
const flush=()=>new Promise(resolve=>setImmediate(resolve))
async function detail(options={}){
  const h=hookHarness(),nodes=[],requests=[],toasts=[],toast=value=>toasts.push(value)
  const product={id:'p',name:'Peso',kind:'STANDARD',unit_metadata_version:2,company_id:'A',category_id:1,supplier_id:'supplier',price:'2',cost:'1.123456789012',stock:'0.123456',min_stock:'0.000001',base_unit_id:'kg',base_unit:{...unit,id:'kg',quantity_decimals:6},quantity_decimals:6,unit_revision:4,presentations:[],available_for_sale:true}
  Object.assign(product,options.product??{})
  const api={apiFetch:async(path,requestOptions={})=>{requests.push({path,options:requestOptions});if(options.respond&&requestOptions.method&&requestOptions.method!=='GET')return options.respond(path,requestOptions,product);return path.includes('/presentations')?{items:product.presentations,unit_revision:4,base_unit_locked:true}:product},getApiBaseUrl:()=>'/api'}
  const service=loadReportModule('../../services/productService.ts',{'./api':api})
  const realUnitApi={'../units/public':loadReportModule('../inventory/units/public.ts',{'@/services/api':api})}
  const Page=loadReportModule('../inventory/products/ProductDetailPage.tsx',{...realUnitApi,react:h.hooks,'react-router-dom':{useParams:()=>({id:'p'}),useNavigate:()=>()=>{},useSearchParams:()=>[new URLSearchParams('editar=1'),()=>{}]},'@/components/layout/PageNavigation':{usePageTrail(){}},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:true,inventoryServicesEnabled:true,locale:'es-GT',currencyCode:'GTQ'})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'../units/useUnitCatalog':{useUnitCatalog:()=>({scope:{companyId:'A',branchId:'B'},units:[product.base_unit],canWrite:true,isLoading:false,isError:false})},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},branches:[]})},'@/modules/appointments/useServiceScheduleDraft':{useServiceScheduleDraft:()=>({ready:true,allowed:false,dirty:false,payload:{},reload:async()=>{},reset(){}})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},'@/hooks/useSuppliers':{useSuppliers:()=>({data:{items:[]}})},'@/hooks/useCategories':{useCategories:()=>({data:[]})},'@/hooks/use-toast':{useToast:()=>({toast})},'@/hooks/useDeleteProduct':{useDeleteProduct:()=>({}),useRemoveProductFromBranch:()=>({})},'@/hooks/useUpdateProduct':{__esModule:true,default:()=>({mutateAsync:({id,payload})=>service.updateProduct(id,payload),isPending:false})},'@/services/api':api,'./api':api},nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())};render();await flush();render();await flush();render();render()
  return {nodes,requests,toasts,render,unmount:h.unmount}
}
test('real detail name edit omits an unchanged derived12 cost and writes exact base strings',async()=>{
  const d=await detail();try{
    d.nodes.find(n=>n.props.id==='edit-name').props.onChange({target:{value:'Nuevo nombre'}});d.render()
    await d.nodes.find(n=>n.props.children==='Guardar cambios').props.onClick()
    const request=d.requests.find(r=>r.options.method==='PUT');assert.ok(request)
    const payload=JSON.parse(request.options.body)
    assert.equal(payload.cost,undefined);assert.equal(payload.stock,'0.123456');assert.equal(payload.min_stock,'0.000001');assert.equal(payload.unit_revision,4)
  }finally{d.unmount()}
})
test('real detail changed manual cost accepts six places and rejects seven without a request',async()=>{
  for(const [cost,allowed] of [['1,123456',true],['1,1234567',false]]){
    const d=await detail();try{d.nodes.find(n=>n.props.id==='edit-cost').props.onChange({target:{value:cost}});d.render();await d.nodes.find(n=>n.props.children==='Guardar cambios').props.onClick();const request=d.requests.find(r=>r.options.method==='PUT');assert.equal(!!request,allowed);if(allowed)assert.equal(JSON.parse(request.options.body).cost,'1.123456')}finally{d.unmount()}
  }
})
test('real presentation successor refreshes revision and defaults without wiping another scalar draft',async()=>{
  const first={id:'box',product_id:'p',company_id:'A',name:'Caja',label:'caja',factor:'24',quantity_decimals:0,purchase_enabled:true,sale_enabled:true,active:true,version:1,prices:{LIST:null,WHOLESALE:null,PROMOTION:null}}
  const second={...first,id:'bag',name:'Saco',factor:'10'}
  const d=await detail({product:{presentations:[first,second],default_purchase_presentation_id:'box'},respond:(path,request,product)=>path.includes('/presentations/')?{presentation:{...first,id:'successor',factor:'25',version:2},unit_revision:5}:product})
  try{
    d.nodes.find(n=>n.props.id==='edit-name').props.onChange({target:{value:'Borrador sin guardar'}});d.render()
    let fields=d.nodes.find(n=>n.type?.name==='UnitSettingsFields')
    const changed={...fields.props.value,presentations:fields.props.value.presentations.map(p=>p.id==='box'?{...p,factor:'25'}:p)}
    fields.props.onChange(changed);d.render();fields=d.nodes.find(n=>n.type?.name==='UnitSettingsFields')
    await fields.props.onSavePresentation(fields.props.value.presentations[0]);d.render();d.render()
    fields=d.nodes.find(n=>n.type?.name==='UnitSettingsFields')
    assert.equal(d.nodes.find(n=>n.props.id==='edit-name').props.value,'Borrador sin guardar')
    assert.deepEqual(fields.props.value.presentations.map(p=>p.id),['successor','bag'])
    assert.equal(fields.props.value.defaultPurchaseKey,'successor')
    const save=d.nodes.find(n=>n.props.children==='Guardar cambios');assert.equal(save.props.disabled,false);await save.props.onClick()
    const request=d.requests.findLast(r=>r.path==='/api/products/p'&&r.options.method==='PUT')
    assert.equal(JSON.parse(request.options.body).unit_revision,5)
    assert.equal(JSON.parse(d.requests.find(r=>r.path.endsWith('/presentations/box')).options.body).factor,'25')
  }finally{d.unmount()}
})

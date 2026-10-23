const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const tick=()=>new Promise(setImmediate)
const base={id:'UNIT',name:'Unidad',label:'ud',family:'COUNT',factor:'1',quantity_decimals:0,active:true}
const presentation={id:'PACK',name:'Caja',label:'caja',factor:'6',quantity_decimals:0,version:1,active:true,purchase_enabled:true,sale_enabled:true,prices:{LIST:null,WHOLESALE:null,PROMOTION:null},barcode:null}
const product={id:'P',name:'Café',kind:'STANDARD',price:'5.125',cost:'2',stock:'12',min_stock:'1',category_id:1,supplier_id:'S',category:{name:'Bebidas'},supplier:{name:'Proveedor'},quantity_decimals:0,base_unit_id:'UNIT',base_unit:base,unit_metadata_version:2,unit_revision:1,presentations:[presentation],base_unit_locked:true}
function fixture({locked=true,enabled=true,edit=false,allowed=true,network}={}){
 const h=hookHarness(),nodes=[],requests=[],notifications=[];let id='P',scope={companyId:'A',branchId:'B'},row={...product,base_unit_locked:locked},params=new URLSearchParams(edit?'editar=1':'')
 const boundary={getApiBaseUrl:()=>'/api',apiFetch:async(url,options)=>{requests.push({url,options});if(network)return network(url,options,row);if(url.includes('/presentations'))return{items:row.presentations,base_unit_locked:row.base_unit_locked,unit_revision:row.unit_revision};return {...row,id}}}
 const service=loadReportModule('../../services/productService.ts',{'./api':boundary})
 const Page=loadReportModule('../inventory/products/ProductDetailPage.tsx',{
  react:h.hooks,[require('node:path').resolve(__dirname,'../src/services/api.ts')]:boundary,'@/services/api':boundary,'@/services/productService':service,
  'react-router-dom':{useParams:()=>({id}),useNavigate:()=>()=>{},useSearchParams:()=>[params,next=>params=next]},
  '@/components/layout/PageNavigation':{usePageTrail(){}},'@/hooks/use-toast':{useToast:()=>({toast:n=>notifications.push(n)})},
  '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>allowed})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ',inventoryServicesEnabled:true,inventoryUnitsEnabled:enabled})},
  '../units/useUnitCatalog':{useUnitCatalog:()=>({units:[base],scope,canWrite:true})},
  '@/hooks/useSuppliers':{useSuppliers:()=>({data:{items:[{id:'S',name:'Proveedor'}]}})},'@/hooks/useCategories':{useCategories:()=>({data:[{id:1,name:'Bebidas'}]})},
  '@/hooks/useUpdateProduct':()=>({mutateAsync:async()=>{},isPending:false}),'@/hooks/useDeleteProduct':{useDeleteProduct:()=>({}),useRemoveProductFromBranch:()=>({})},
  '@/context/useTenant':{useTenant:()=>({company:{id:scope.companyId},branch:{id:scope.branchId},branches:[]})},
  '@/modules/appointments/useServiceScheduleDraft':{useServiceScheduleDraft:()=>({allowed:false,ready:true,dirty:false,payload:{},reset(){},reload:async()=>{}})},
  '@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({request:fn=>fn(),dialog:null})},
 },nodes).default
 const render=()=>{nodes.length=0;h.render(Page);return [...nodes]}
 const node=name=>nodes.find(n=>n.type?.name===name)
 return{requests,notifications,render,node,setRow:next=>row=next,setOwner:(next,nextScope=scope)=>{id=next;scope=nextScope},async load(){render();await tick();render();render()},tab(value){nodes.find(n=>n.props.onValueChange&&['information','lots','locations','kit'].includes(n.props.value)).props.onValueChange(value);return render()},close:()=>h.unmount()}
}
test('opening advanced inventory detail reuses the product metadata without a second presentations GET',async()=>{
 const f=fixture();try{await f.load();assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/api/products/P');assert.deepEqual(f.requests[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'});const units=f.node('UnitSettingsFields');assert.equal(units.props.value.presentations[0].id,'PACK');assert.equal(units.props.readOnly,true)}finally{f.close()}
})
for(const locked of [true,false,undefined])test(`editing base lock stays fail-closed when product metadata is ${locked}`,async()=>{
 const f=fixture({locked,edit:true});if(locked===undefined){const row={...product};delete row.base_unit_locked;f.setRow(row)}try{await f.load();assert.equal(f.node('UnitSettingsFields').props.baseLocked,locked!==false)}finally{f.close()}
})
test('secondary panels mount only on first visit and remain in the tree while hidden',async()=>{
 const f=fixture();try{await f.load();for(const name of ['ProductLotsSection','ProductLocationsSection','ProductKitSection'])assert.equal(f.node(name),undefined)
 f.tab('lots');assert.ok(f.node('ProductLotsSection'));assert.equal(f.node('ProductLocationsSection'),undefined)
 f.tab('locations');assert.ok(f.node('ProductLotsSection'));assert.ok(f.node('ProductLocationsSection'))
 f.tab('information');assert.ok(f.node('ProductLotsSection'));assert.ok(f.node('ProductLocationsSection'));assert.equal(f.node('ProductKitSection'),undefined)
 f.setOwner('P2');f.render();await tick();f.render();assert.equal(f.node('ProductLotsSection'),undefined);assert.equal(f.node('ProductLocationsSection'),undefined)
 }finally{f.close()}
})
test('stock refresh updates product lock metadata',async()=>{
 const f=fixture()
 try{await f.load();f.tab('lots');f.setRow({...product,base_unit_locked:false});f.node('ProductLotsSection').props.onMutated();await tick();f.render();f.node('ProductDetailSummary').props.actions.props.children[0].props.onClick();f.render();assert.equal(f.node('UnitSettingsFields').props.baseLocked,false)
 }finally{f.close()}
})
test('an old refresh cannot overwrite a product after leaving and returning to the same context',async()=>{
 let release,reads=0;const f=fixture({network:async(_url,_o,row)=>++reads===2?new Promise(r=>release=r):{...row,name:'Actual'}})
 try{await f.load();f.tab('lots');f.node('ProductLotsSection').props.onMutated();f.setOwner('P2');f.render();await tick();f.render();f.setOwner('P');f.render();await tick();f.render();release({...product,name:'Viejo'});await tick();f.render();assert.equal(f.node('ProductDetailSummary').props.product.name,'Actual')}finally{f.close()}
})
test('saving and archiving a presentation retain scalar drafts, exact revision and a locked base',async()=>{
 const f=fixture({edit:true,locked:false,network:async(url,o,row)=>{
  if(o.method==='PUT'||o.method==='DELETE')return{presentation:{...presentation,id:'PACK2',name:'Caja nueva',prices:{LIST:'6.125'},active:o.method!=='DELETE'},unit_revision:o.method==='DELETE'?3:2}
  return row
 }})
 try{await f.load();const name=f.render().find(n=>n.props.value==='Café'&&n.props.onChange);name.props.onChange({target:{value:'Borrador'}});f.render()
  let units=f.node('UnitSettingsFields');await units.props.onSavePresentation({...units.props.value.presentations[0],name:'Caja nueva',price:'6.125'});f.render();units=f.node('UnitSettingsFields');assert.equal(units.props.baseLocked,true);assert.equal(units.props.value.presentations[0].id,'PACK2');assert.equal(units.props.value.presentations[0].price,'6.125');assert.ok(f.render().some(n=>n.props.value==='Borrador'));assert.equal(JSON.parse(f.requests.at(-1).options.body).unit_revision,1)
  await units.props.onArchivePresentation(units.props.value.presentations[0]);f.render();assert.equal(f.node('UnitSettingsFields').props.value.presentations.length,0);assert.equal(f.node('UnitSettingsFields').props.baseLocked,true);assert.equal(JSON.parse(f.requests.at(-1).options.body).unit_revision,2)
 }finally{f.close()}
})
test('late initial product responses are aborted and cannot replace the next scoped product',async()=>{
 let release;const f=fixture({network:async(url,_o,row)=>url==='/api/products/P'?new Promise(r=>release=r):{...row,id:'NEW',name:'Nuevo'}})
 try{f.render();f.setOwner('NEW',{companyId:'C',branchId:'D'});f.render();assert.equal(f.requests[0].options.signal.aborted,true);await tick();release(product);await tick();f.render();assert.equal(f.node('ProductDetailSummary').props.product.id,'NEW');assert.equal(f.requests.length,2)}finally{f.close()}
})
test('legacy units-off and read-only products do not request presentation configuration',async()=>{
 const f=fixture({enabled:false,allowed:false});f.setRow({...product,base_unit_id:null,base_unit:null,unit_metadata_version:undefined,presentations:[]});try{await f.load();assert.equal(f.requests.length,1);assert.equal(f.node('UnitSettingsFields').props.enabled,false);assert.equal(f.node('ProductKitSection'),undefined)}finally{f.close()}
})
for(const kind of ['STANDARD','SERVICE'])test(`units-enabled legacy ${kind} can configure its first base only with explicit unlocked metadata`,async()=>{
 const f=fixture({edit:true,enabled:true});f.setRow({...product,kind,base_unit_id:null,base_unit:null,unit_metadata_version:1,presentations:[],base_unit_locked:false})
 try{await f.load();assert.equal(f.requests.length,1);assert.equal(f.node('UnitSettingsFields').props.enabled,true);assert.equal(f.node('UnitSettingsFields').props.baseLocked,false);assert.equal(f.node('UnitSettingsFields').props.value.baseUnitId,'')}finally{f.close()}
})

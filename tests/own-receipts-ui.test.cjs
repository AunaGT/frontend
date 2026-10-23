const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const product={id:'P',name:'Producto terminado',kind:'STANDARD',price:10,cost:1,stock:2,minStock:0,barcode:'123'}
function fixture(source='PRODUCTION'){
 const h=hookHarness(),nodes=[],requests=[],paths=[],notices=[];let tenant={company:{id:'A'},branch:{id:'B'},registerTenantExitGuard:()=>()=>{}}
 const api={apiFetch:async(path,options)=>{requests.push({path,options});return {incomingMerchandise:{id:'receipt'}}}}
 const {OwnReceiptForm}=loadReportModule('../merchandise/components/OwnReceiptForm.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>path=>paths.push(path)},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}})},'@/context/useTenant':{useTenant:()=>tenant},'@/context/useAuth':{useAuth:()=>({user:{id:'U'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/hooks/use-toast':{useToast:()=>({toast:value=>notices.push(value)})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},'@/services/api':api,'./api':api},nodes)
 const render=()=>{nodes.length=0;return h.render(()=>OwnReceiptForm({source,onSourceChange(){},locations:[]}))}
 return{h,nodes,requests,paths,notices,api,render,setTenant:value=>tenant=value}
}
const field=(f,label)=>f.nodes.find(n=>n.props['aria-label']===label)
const review=f=>f.nodes.find(n=>n.props.onClick&&n.props.children===(f.source==='INITIAL'?'Revisar entrada':'Revisar fabricación')).props.onClick()
test('production guides through output and costs without supplier or payment and confirms using Auna',async()=>{
 const f=fixture();try{
  f.render();assert.equal(f.nodes.some(n=>n.type?.name==='SupplierPicker'),false)
  f.nodes.find(n=>n.type?.name==='ProductPicker'&&n.props['aria-label']===undefined).props.onPick(product);f.render()
  field(f,'Cantidad de Producto terminado').props.onChange({target:{value:'3'}});field(f,'Materiales no inventariados').props.onChange({target:{value:'15'}});field(f,'Mano de obra').props.onChange({target:{value:'3'}});f.render();review(f);f.render()
  assert.equal(f.requests.length,0);const dialog=f.nodes.find(n=>n.type?.name==='ConfirmDialog'&&n.props.open);assert.equal(dialog.props.appearance,'auna');await dialog.props.onConfirm()
  const payload=JSON.parse(f.requests[0].options.body);assert.equal(payload.source,'PRODUCTION');assert.equal(payload.items[0].quantity,'3');assert.deepEqual(payload.costs,{materials:'15',labor:'3',other:'0'});assert.equal(payload.supplier_id,undefined);assert.equal(payload.payment_status,undefined);assert.deepEqual(f.paths,['/mercancia/receipt'])
 }finally{f.h.unmount()}
})
test('initial entry collects quantity and unit cost without manufacturing or supplier fields',async()=>{
 const f=fixture('INITIAL');f.source='INITIAL';try{
  f.render();f.nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(product);f.render();assert.equal(field(f,'Mano de obra'),undefined)
  field(f,'Cantidad de Producto terminado').props.onChange({target:{value:'2'}});field(f,'Costo de Producto terminado').props.onChange({target:{value:'6'}});f.render();review(f);f.render();await f.nodes.find(n=>n.type?.name==='ConfirmDialog'&&n.props.open).props.onConfirm()
  const payload=JSON.parse(f.requests[0].options.body);assert.equal(payload.source,'INITIAL');assert.equal(payload.items[0].unit_cost,'6');assert.equal(payload.components,undefined);assert.equal(payload.supplier_id,undefined)
 }finally{f.h.unmount()}
})
test('opening stock can keep an untouched twelve-place average cost suggested by the product',async()=>{
 const f=fixture('INITIAL');f.source='INITIAL';try{f.render();f.nodes.find(n=>n.type?.name==='ProductPicker').props.onPick({...product,cost:3.333333333333,unitValues:{price:'10',cost:'3.333333333333',stock:'2',minStock:'0'}});f.render();review(f);f.render();const dialog=f.nodes.find(n=>n.type?.name==='ConfirmDialog'&&n.props.open);assert.ok(dialog,'prefilled cost must pass validation');await dialog.props.onConfirm();assert.equal(JSON.parse(f.requests[0].options.body).items[0].unit_cost,'3.333333333333')}finally{f.h.unmount()}
})
test('failed receipt retry preserves its key and switching company aborts the old response',async()=>{
 const f=fixture();try{
  f.api.apiFetch=async(path,options)=>{f.requests.push({path,options});throw Error('network')}
  f.render();f.nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(product);f.render();review(f);f.render();await f.nodes.find(n=>n.type?.name==='ConfirmDialog'&&n.props.open).props.onConfirm();f.render()
  review(f);f.render();let resolve;f.api.apiFetch=(path,options)=>{f.requests.push({path,options});return new Promise(done=>resolve=done)}
  const pending=f.nodes.find(n=>n.type?.name==='ConfirmDialog'&&n.props.open).props.onConfirm();f.setTenant({company:{id:'C'},branch:{id:'D'},registerTenantExitGuard:()=>()=>{}});f.render();assert.equal(f.requests[1].options.signal.aborted,true)
  resolve({incomingMerchandise:{id:'old'}});await pending;assert.deepEqual(f.paths,[]);assert.equal(JSON.parse(f.requests[0].options.body).request_key,JSON.parse(f.requests[1].options.body).request_key)
 }finally{f.h.unmount()}
})

const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const product={id:'p',name:'Producto',kind:'STANDARD',barcode:'01',cost:999,unitValues:{price:'999999999',cost:'5',stock:'0',minStock:'0'},unitConfiguration:{base_unit_id:'u',base_unit:{id:'u',code:'UNIT',label:'unidades',name:'Unidad'},quantity_decimals:0,unit_revision:7,default_purchase_presentation_id:'box',presentations:[{id:'box',version:1,name:'Caja',label:'caja',factor:'24',quantity_decimals:0,active:true,purchase_enabled:true,sale_enabled:false,prices:{}}]}}
function add(f,p=product,qty='2') {
  f.nodes.find(n=>n.type?.name==='SupplierPicker').props.onSelect({id:'supplier',name:'Proveedor'});f.render()
  f.nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(p);f.render()
  f.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto').props.onChange({target:{value:qty}});f.render()
}
const submit=f=>f.nodes.find(n=>n.props.onClick&&n.props.children?.includes?.('Registrar entrada')).props.onClick()
test('purchase aborts the captured preview on tenant change and never sends the old entry',async()=>{
  const f=fixture();try {
    let resolve,signal
    f.api.apiFetch=async(path,options)=>{f.requests.push({path,options});signal=options.signal;return new Promise(done=>resolve=done)}
    add(f);const pending=submit(f)
    f.setTenant({company:{id:'C'},branch:{id:'D'},registerTenantExitGuard:()=>()=>{}});f.render()
    assert.equal(signal.aborted,true);resolve({base_qty:'48'});await pending
    assert.equal(f.requests.filter(r=>r.path==='/api/products/register-incoming').length,0)
    f.render();assert.equal(f.nodes.filter(n=>n.props['aria-label']==='Cantidad de Producto').length,0)
  } finally {f.h.unmount()}
})
test('purchase changes its retry key when the reviewed commercial payload changes',async()=>{
  const f=fixture();try {
    add(f);await submit(f);f.render()
    f.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto').props.onChange({target:{value:'3'}});f.render();await submit(f)
    const posts=f.requests.filter(r=>r.path==='/api/products/register-incoming').map(r=>JSON.parse(r.options.body))
    assert.equal(posts.length,2);assert.notEqual(posts[0].request_key,posts[1].request_key);assert.equal(posts[1].items[0].quantity,'3')
  } finally {f.h.unmount()}
})
test('purchase requires explicit rounding acceptance before preview or registration',async()=>{
  const f=fixture();try {
    const p={...product,unitConfiguration:{...product.unitConfiguration,quantity_decimals:6,presentations:[{...product.unitConfiguration.presentations[0],factor:'0.333333333333',quantity_decimals:6}]}}
    add(f,p,'0.1');const cost=f.nodes.find(n=>n.props['aria-label']==='Costo de Producto');cost.props.onChange({target:{value:'1'}});f.render()
    await submit(f);assert.equal(f.requests.length,0)
    f.nodes.find(n=>n.type?.name==='UnitLineFields').props.onAcceptRounding(true);f.render();await submit(f)
    const post=f.requests.find(r=>r.path==='/api/products/register-incoming');assert.ok(post)
    assert.equal(JSON.parse(post.options.body).items[0].accept_rounding,true);assert.equal(JSON.parse(post.options.body).items[0].quantity,'0.1')
    const preview=JSON.parse(f.requests.find(r=>r.path.endsWith('/preview')).options.body);assert.equal(preview.unit_price,undefined);assert.equal(preview.line_total,undefined)
  } finally {f.h.unmount()}
})
function fixture(){const h=hookHarness(),nodes=[],requests=[],toasts=[];let failing=true,tenant={company:{id:'A'},branch:{id:'B'},registerTenantExitGuard:()=>()=>{}};const api={apiFetch:async(path,options={})=>{requests.push({path,options});if(path.endsWith('/preview'))return {qty:'2',base_qty:'48',unit_snapshot:{version:2},unit_metadata_version:2};if(failing){failing=false;throw Error('network')}return{}},getActiveCompanyId:()=>tenant.company.id,getActiveBranchId:()=>tenant.branch.id};const Page=loadReportModule('../merchandise/pages/RegisterIncomingMerchandise.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@tanstack/react-query':{useQuery:()=>({data:[]}),useQueryClient:()=>({invalidateQueries:async()=>{}})},'@/context/useTenant':{useTenant:()=>tenant},'@/context/useAuth':{useAuth:()=>({user:{id:'actor'}})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn()})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:true,currencyCode:'GTQ',locale:'es-GT'})},'@/hooks/use-toast':{useToast:()=>({toast:v=>toasts.push(v)})},'@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[]})},'@/hooks/useSupplier':{useSupplier:()=>({data:{id:'supplier',name:'Proveedor',paymentTermsList:[]}})},'@/services/supplierService':{adaptApiSupplier:p=>p},'@/modules/inventory/units/public':loadReportModule('../inventory/units/public.ts',{'@/services/api':api}),'@/services/api':api,'./api':api},nodes).RegisterIncomingMerchandise;const render=()=>{nodes.length=0;h.render(()=>Page())};render();return{nodes,requests,toasts,render,h,api,setTenant:v=>tenant=v}}
test('real purchase sends two commercial boxes once with exact cost and stable scoped retry key',async()=>{const f=fixture();try{f.nodes.find(n=>n.type?.name==='SupplierPicker').props.onSelect({id:'supplier',name:'Proveedor'});f.render();f.nodes.find(n=>n.type?.name==='ProductPicker').props.onPick(product);f.render();f.nodes.find(n=>n.props['aria-label']==='Cantidad de Producto').props.onChange({target:{value:'2'}});f.render();await f.nodes.find(n=>n.props.onClick&&n.props.children?.includes?.('Registrar entrada')).props.onClick();f.render();await f.nodes.find(n=>n.props.onClick&&n.props.children?.includes?.('Registrar entrada')).props.onClick();const posts=f.requests.filter(r=>r.path==='/api/products/register-incoming');assert.equal(posts.length,2,JSON.stringify({requests:f.requests,toasts:f.toasts}));const first=JSON.parse(posts[0].options.body),second=JSON.parse(posts[1].options.body);assert.equal(first.items[0].quantity,'2');assert.equal(first.items[0].unit_cost,'120');assert.equal(first.items[0].presentation_id,'box');assert.equal(first.items[0].unit_revision,7);assert.equal(first.items[0].base_qty,undefined);assert.ok(first.request_key);assert.equal(first.request_key,second.request_key);assert.deepEqual(posts[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'});assert.ok(f.requests.some(r=>r.path.endsWith('/preview')&&JSON.parse(r.options.body).operation==='PURCHASE'))}finally{f.h.unmount()}})

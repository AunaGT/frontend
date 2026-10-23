const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('scans waiting for supplier are preserved and add products without registering merchandise',async()=>{
 const h=hookHarness(),nodes=[],writes=[]
 const Page=loadReportModule('../merchandise/pages/RegisterIncomingMerchandise.tsx',{
  react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@tanstack/react-query':{useQuery:()=>({data:[]}),useQueryClient:()=>({invalidateQueries(){}})},
  '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},registerTenantExitGuard(){}})},'@/context/useAuth':{useAuth:()=>({user:{id:'U'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:false,currencyCode:'GTQ',locale:'es-GT'})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[]})},'@/hooks/useSupplier':{useSupplier:()=>({data:{id:'SUP',name:'Proveedor',paymentTermsList:[]}})},'@/services/supplierService':{adaptApiSupplier:p=>p},
  '@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn()})},'@/components/shared/ScannerField':{ScannerField:()=>null},
  '@/services/contextScannerService':{resolveContextScan:async code=>({product:{id:code,name:`Producto ${code}`,barcode:code,kind:'STANDARD',cost:'2',price:'5'},presentationId:null})},
  '@/services/api':{apiFetch:async(...args)=>{writes.push(args);return[]}},
  './api':{apiFetch:async(...args)=>{writes.push(args);return[]}},
 },nodes).RegisterIncomingMerchandise
 const render=()=>{nodes.length=0;h.render(()=>Page())}
 try{render();await nodes.find(n=>n.type.name==='ScannerField').props.onScan('A',new AbortController().signal);render();await nodes.find(n=>n.type.name==='ScannerField').props.onScan('B',new AbortController().signal);render()
  nodes.find(n=>n.type.name==='SupplierPicker').props.onSelect({id:'SUP',name:'Proveedor'});render();render()
  assert.ok(nodes.find(n=>n.props['aria-label']==='Cantidad de Producto A'));assert.ok(nodes.find(n=>n.props['aria-label']==='Cantidad de Producto B'));assert.equal(writes.length,0)
 }finally{h.unmount()}
})

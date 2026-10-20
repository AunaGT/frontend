const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)}}

async function workspace(t,kind){
  const previous={window:global.window,localStorage:global.localStorage,fetch:global.fetch}
  const storage=new Map([['tenant:companyId','A'],['tenant:branchId','BA']]),events=new EventTarget(),calls=[],requests=[],uploads=[]
  let accept=false,id='p'
  global.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
  global.window=events;events.confirm=()=>{calls.push('confirm');return accept};events.location={reload:()=>{const event=new Event('beforeunload',{cancelable:true});events.dispatchEvent(event);calls.push(event.defaultPrevented?'blocked-unload':'reload')}}
  global.fetch=()=>{const job=deferred();uploads.push(job);return job.promise}
  const provider=hookHarness(),page=hookHarness(),nodes=[],toast=()=>{},queryClient={clear:()=>calls.push('clear')}
  const user={id:'U',companies:[{id:'A'},{id:'B'}],branches:[{id:'BA',company_id:'A',is_default:true},{id:'BA2',company_id:'A'},{id:'BB',company_id:'B',is_default:true}],permissions:[]}
  const tenantApi={getActiveCompanyId:()=>storage.get('tenant:companyId'),getActiveBranchId:()=>storage.get('tenant:branchId'),setActiveTenant:(company,branch)=>{storage.set('tenant:companyId',company);storage.set('tenant:branchId',branch);events.dispatchEvent(new Event('tenant:changed'))}}
  const {TenantProvider}=loadReportModule('../../context/TenantProvider.tsx',{react:provider.hooks,'./useAuth':{useAuth:()=>({user})},'@tanstack/react-query':{useQueryClient:()=>queryClient},'@/services/api':tenantApi})
  let tenant=provider.render(()=>TenantProvider({children:null})).props.value
  const product=()=>({id,name:'Producto',kind:'STANDARD',company_id:tenant.company.id,category_id:1,supplier_id:'supplier',stock:0,min_stock:0,price:2,cost:1,brand:'',size:'',barcode:'',description:'',available_for_sale:true})
  const api={getApiBaseUrl:()=>'/api',apiFetch:async(path,options={})=>{requests.push({path,options});return product()}}
  const mocks={react:{...page.hooks,useContext:()=>null},'react-router-dom':{useParams:()=>({id}),useNavigate:()=>()=>{},useSearchParams:()=>[new URLSearchParams('editar=1'),()=>{}]},'@/context/useTenant':{useTenant:()=>tenant},'@/components/layout/PageNavigation':{usePageTrail(){}},'@/hooks/use-toast':{useToast:()=>({toast})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:kind==='catalog',inventoryServicesEnabled:true,locale:'es-GT',currencyCode:'GTQ'})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/modules/appointments/useServiceScheduleDraft':{useServiceScheduleDraft:()=>({ready:true,allowed:false,dirty:false,payload:{},reset(){},reload:async()=>{}})},'../units/useUnitCatalog':{useUnitCatalog:()=>({scope:{companyId:tenant.company.id,branchId:tenant.branch.id},units:[],canWrite:true,isLoading:false,isError:false})},'./useUnitCatalog':{useUnitCatalog:()=>({scope:{companyId:tenant.company.id,branchId:tenant.branch.id},units:[],canWrite:true,isLoading:false,isError:false,refetch:async()=>{}})},'@/hooks/useCategories':{useCategories:()=>({data:[]})},'@/hooks/useSuppliers':{useSuppliers:()=>({data:{items:[]}})},'@/hooks/useExperienceProfile':{useExperienceProfile:()=>({showAdvancedByDefault:true})},'@/hooks/useCreateProduct':{useCreateProduct:()=>({isPending:false,mutate(){}})},'@/hooks/useUpdateProduct':{__esModule:true,default:()=>({isPending:false})},'@/hooks/useDeleteProduct':{useDeleteProduct:()=>({}),useRemoveProductFromBranch:()=>({})},'./hooks/useKitAssemblePrompt':{useKitAssemblePrompt:()=>({promptDialog:null})},'@/services/api':api,'./api':api,'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:50,viewMode:'table',setPage(){},setPageSize(){},setViewMode(){}})},'@/hooks/useCardPagination':{useCardPagination:()=>({pageSize:50,containerRef:null})}}
  const target=kind==='catalog'?'../inventory/units/UnitsPage.tsx':`../inventory/products/Product${kind==='create'?'Create':'Detail'}Page.tsx`
  const Page=loadReportModule(target,mocks,nodes).default
  const render=()=>{tenant=provider.render(()=>TenantProvider({children:null})).props.value;nodes.length=0;page.render(()=>Page())}
  const settle=async()=>{render();await flush();render();render()}
  await settle()
  t.after(()=>{page.unmount();provider.unmount();Object.assign(global,previous)})
  const image=()=>nodes.find(node=>node.type?.name==='ImageUploadDropzone')
  const edit=()=>{
    if(kind==='catalog'){nodes.find(n=>n.props.children==='Nueva unidad').props.onClick();render();nodes.find(n=>n.props.id==='unit-name').props.onChange({target:{value:'Borrador'}})}
    else nodes.find(n=>kind==='detail'?n.props.id==='edit-name':n.props.placeholder==='Whisky Buchanans 18...').props.onChange({target:{value:'Borrador'}})
    render()
  }
  const draftValue=()=>nodes.find(n=>kind==='catalog'?n.props.id==='unit-name':kind==='detail'?n.props.id==='edit-name':n.props.placeholder==='Whisky Buchanans 18...')?.props.value
  return{nodes,calls,storage,requests,uploads,render,settle,image,edit,draftValue,allow:()=>accept=true,switch:(which)=>tenant[which==='company'?'setCompany':'setBranch'](which==='company'?'B':'BA2'),tenant:()=>tenant,product:next=>{id=next},dispose:()=>page.unmount()}
}

for(const kind of ['create','detail','catalog'])for(const scope of ['company','branch'])test(`${kind} dirty page blocks actual tenant ${scope} mutation before storage changes`,async t=>{
  const w=await workspace(t,kind);w.edit();const oldRequests=w.requests.slice()
  w.switch(scope);await w.settle()
  assert.equal(w.tenant().company.id,'A');assert.equal(w.tenant().branch.id,'BA')
  assert.equal(w.storage.get('tenant:companyId'),'A');assert.equal(w.storage.get('tenant:branchId'),'BA');assert.equal(w.draftValue(),'Borrador');assert.deepEqual(w.calls,['confirm'])
  w.allow();w.switch(scope);await w.settle()
  assert.equal(w.tenant().company.id,scope==='company'?'B':'A');assert.equal(w.tenant().branch.id,scope==='company'?'BB':'BA2')
  assert.equal(w.calls.filter(c=>c==='confirm').length,2);assert.ok(w.calls.includes('reload'));assert.ok(!w.calls.includes('blocked-unload'))
  assert.notEqual(w.draftValue(),'Borrador')
  if(kind==='detail')assert.ok(oldRequests[0].options.signal.aborted)
  w.dispose()
  const prompts=w.calls.filter(c=>c==='confirm').length;w.switch(scope==='company'?'branch':'company');assert.equal(w.calls.filter(c=>c==='confirm').length,prompts)
})
for(const kind of ['create','detail'])test(`${kind} old image cannot set state or clear a newer upload after tenant reset`,async t=>{
  const w=await workspace(t,kind),file=new File(['image'],'photo.png',{type:'image/png'})
  w.image().props.onFileSelect(file);w.render();assert.equal(w.image().props.isUploading,true)
  w.allow();w.switch('company');await w.settle();assert.equal(w.image().props.isUploading,false)
  w.image().props.onFileSelect(file);w.render();assert.equal(w.image().props.isUploading,true)
  w.uploads[0].resolve({ok:true,json:async()=>({imageUrl:'/old.png'})});await w.settle()
  assert.equal(w.image().props.isUploading,true);assert.ok(!w.nodes.some(n=>n.props.src==='/old.png'))
  w.uploads[1].resolve({ok:true,json:async()=>({imageUrl:'/new.png'})});await w.settle()
  assert.equal(w.image().props.isUploading,false);assert.ok(w.nodes.some(n=>n.props.src==='/new.png'))
})
test('detail product navigation invalidates image ownership even when the tenant stays the same',async t=>{
  const w=await workspace(t,'detail'),file=new File(['image'],'photo.png',{type:'image/png'})
  w.image().props.onFileSelect(file);w.product('other');await w.settle();assert.equal(w.image().props.isUploading,false)
  w.image().props.onFileSelect(file);w.render();w.uploads[0].resolve({ok:true,json:async()=>({imageUrl:'/old-product.png'})});await w.settle()
  assert.equal(w.image().props.isUploading,true);assert.ok(!w.nodes.some(n=>n.props.src==='/old-product.png'))
  w.uploads[1].resolve({ok:true,json:async()=>({imageUrl:'/other-product.png'})});await w.settle();assert.equal(w.image().props.isUploading,false)
})
for(const kind of ['create','detail'])test(`${kind} newest image owns completion when two callbacks overlap in one context`,async t=>{
  const w=await workspace(t,kind),file=new File(['image'],'photo.png',{type:'image/png'})
  w.image().props.onFileSelect(file);w.image().props.onFileSelect(file);w.render()
  w.uploads[0].resolve({ok:true,json:async()=>({imageUrl:'/superseded.png'})});await w.settle()
  assert.equal(w.image().props.isUploading,true);assert.ok(!w.nodes.some(n=>n.props.src==='/superseded.png'))
  w.uploads[1].resolve({ok:true,json:async()=>({imageUrl:'/latest.png'})});await w.settle()
  assert.equal(w.image().props.isUploading,false);assert.ok(w.nodes.some(n=>n.props.src==='/latest.png'))
})

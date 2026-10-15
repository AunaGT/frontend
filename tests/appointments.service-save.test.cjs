const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')
test('perfil inicializa por producto y tenant, refetch no pisa borrador ni precisión comercial', () => {
  const h = hookHarness(); let product = 'one', companyId = 'A', loaded
  const modules = loadReportModule('../appointments/useServiceScheduleDraft.ts', { react: h.hooks,
    './useAgendaContext': { useAgendaContext: () => ({ scope: { companyId, branchId: 'B' }, writable: true, hasPermission: () => true }) },
    './api': { appointmentQueryKey: (s, kind) => [kind], getAgenda() {} },
    '@tanstack/react-query': { useQuery: options => ({ data: options.queryKey[0] === 'profile' ? loaded : { branches: [], providers: [], resources: [] }, isSuccess: true }) },
  })
  const render = () => h.render(() => modules.useServiceScheduleDraft(true, product))
  loaded = { profile: { durationMinutes: 45, expectedVersion: 3 } }
  let state = render(); state.change({ ...state.value, durationMinutes: 60 })
  loaded = { profile: { durationMinutes: 90, expectedVersion: 4 } }
  state = render(); assert.equal(state.value.durationMinutes, 60); assert.equal(state.payload.schedule_profile.expectedVersion, 3)
  assert.equal(Object.hasOwn(state.payload, 'quantity_decimals'), false)
  product = 'two'; companyId = 'C'; loaded = null
  state = render(); assert.equal(state.dirty, false); assert.deepEqual(state.payload, {}); assert.equal(state.value.durationMinutes, 45)
})
test('guardar ProductDetailPage conserva Hora y tres decimales con duración cambiada',async()=>{
  const h=hookHarness(),nodes=[],writes=[];let stateIndex=0
  const raw={id:'p',name:'Asesoría',kind:'SERVICE',service_unit_label:'Hora',quantity_decimals:3,price:100,category_id:'category',available_for_sale:true}
  const product={...raw,serviceUnitLabel:'Hora',quantityDecimals:3,category:'Servicios',price:100}
  const Page=loadReportModule('../inventory/products/ProductDetailPage.tsx',{
    react:{...h.hooks,useContext:()=>null,useState:initial=>h.hooks.useState(stateIndex++===0?raw:initial)},
    'react-router-dom':{...require('react-router-dom'),useParams:()=>({id:'p'}),useNavigate:()=>()=>{},useSearchParams:()=>[new URLSearchParams('editar=1'),()=>{}]},
    '@/modules/appointments/useServiceScheduleDraft':{useServiceScheduleDraft:()=>({allowed:true,ready:true,value:{enabled:true,durationMinutes:60},directory:{branches:[],providers:[],resources:[]},payload:{schedule_profile:{enabled:true,durationMinutes:60,expectedVersion:2}},reset(){},async reload(){}})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},'@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryServicesEnabled:true,locale:'es-GT',currencyCode:'GTQ'})},
    '@/hooks/useSuppliers':{useSuppliers:()=>({data:{items:[]}})},'@/hooks/useCategories':{useCategories:()=>({data:[]})},
    '@/services/productService':{adaptApiProduct:()=>product,fetchProductById:async()=>raw},
    '@/hooks/useUpdateProduct':{__esModule:true,default:()=>({mutateAsync:async input=>{writes.push(input);return raw},isPending:false})},
    '@/hooks/useDeleteProduct':{useDeleteProduct:()=>({}),useRemoveProductFromBranch:()=>({})},
    '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},branches:[]})},
    '@/services/api':{apiFetch(){},getApiBaseUrl:()=>'/api'},'./api':{apiFetch(){},getApiBaseUrl:()=>'/api'},
    '@tanstack/react-query':{useQuery:()=>({data:[]}),useQueryClient:()=>({}),useMutation:()=>({})},
  },nodes).default
  const render=()=>{nodes.length=0;stateIndex=0;return h.render(()=>Page())}
  render();await new Promise(resolve=>setImmediate(resolve));render();render()
  const save=nodes.find(n=>n.props.children==='Guardar cambios'&&n.props.onClick)
  assert.ok(save,'guardado de la página real disponible')
  await save.props.onClick()
  assert.equal(writes.length,1);assert.equal(writes[0].payload.service_unit_label,'Hora');assert.equal(writes[0].payload.quantity_decimals,3)
  assert.equal(writes[0].payload.schedule_profile.durationMinutes,60)
  for(const key of ['stock','supplier_id','tracks_expiry'])assert.equal(Object.hasOwn(writes[0].payload,key),false)
})

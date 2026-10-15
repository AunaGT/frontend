const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('new merchandise entry exposes only actual receipt methods for a paid purchase',()=>{
  const {MemoryRouter}=require('react-router-dom'),nodes=[]
  const Page=loadReportModule('../merchandise/pages/RegisterIncomingMerchandise.tsx',{
    '@/services/api':{apiFetch:async()=>[]},
    './api':{apiFetch:async()=>[]},
    '@/components/shared/ProductPicker':{ProductPicker:()=>null},
    '@/components/shared/SupplierPicker':{SupplierPicker:()=>null},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[{id:1,name:'Caja propia',is_credit:false},{id:2,name:'Crédito',is_credit:true}]})},
    '@/hooks/useSupplier':{useSupplier:()=>({data:null})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ',locale:'es-GT'})},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@tanstack/react-query':{useQuery:()=>({data:[]}),useQueryClient:()=>({invalidateQueries(){}})},
  },nodes).RegisterIncomingMerchandise
  renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page)))
  const field=nodes.find(n=>n.type==='select'&&n.props.id==='receipt-method')
  assert.ok(field);assert.equal(field.props.disabled,true)
  const options=nodes.filter(n=>n.type==='option'&&n.props.children==='Caja propia')
  assert.equal(options.length,1)
})
function screen({error=null}={}){
  const nodes=[],items=[{id:1,name:'Compartido',enabled:true,origin:'BASIC',settlement_kind:'CASH',position:0,_count:{}},{id:2,name:'Privado usado',enabled:false,origin:'COMPANY',settlement_kind:'BANK',position:1,_count:{supplier_payments:1}}]
  const hooks={usePaymentMethodsCatalog:()=>({data:{items,totalPages:1,totalItems:2,page:1,nextPage:null,prevPage:null,summary:{}},error}),
    useCreatePaymentMethod:()=>({}),useUpdatePaymentMethod:()=>({}),useDeletePaymentMethod:()=>({}),
    paymentMethodUsageCounts:m=>({sales:0,closures:0,total:m._count.supplier_payments||0}),catalogApiErrorMessage:e=>e.message}
  const Page=loadReportModule('../catalogs/components/PaymentMethodsTab.tsx',{
    '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'BA'},isConsolidated:false})},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:10,setPage(){}}),useResetPageOnFilterChange(){}},
    './useCatalogSearch':{useCatalogSearch:()=>({search:'',query:'',setSearch(){}})},'@/hooks/usePaymentMethodsCatalog':hooks,
  },nodes).PaymentMethodsTab
  return {html:renderToStaticMarkup(React.createElement(Page)),nodes}
}
test('catalog reflects inactive/type/origin and does not offer shared or used deletion',()=>{
  const {html,nodes}=screen()
  assert.match(html,/Inactivo/);assert.match(html,/Medio bancario/);assert.match(html,/Compartido/)
  const actions=nodes.filter(n=>n.type?.name==='CatalogRowActions')
  assert.equal(actions[0].props.onDelete,undefined);assert.equal(actions[1].props.onDelete,undefined)
})
test('configuration error is announced rather than an empty-success state',()=>{
  const {html}=screen({error:new Error('Inicializa los métodos')})
  assert.match(html,/role="alert"/);assert.match(html,/Inicializa/);assert.doesNotMatch(html,/No hay métodos de pago registrados/)
})

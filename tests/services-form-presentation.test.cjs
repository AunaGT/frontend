const test=require('node:test')
const assert=require('node:assert/strict')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('physical products validate without a habitual supplier',()=>{
  const {EMPTY_PRODUCT_FORM}=loadReportModule('../inventory/products/types.ts')
  const state={...EMPTY_PRODUCT_FORM,name:'Hecho en casa',category:'1',price:'10',supplier:''}
  const {useProductForm}=loadReportModule('../inventory/products/hooks/useProductForm.ts',{react:{...React,useState:()=>[state,()=>{}],useCallback:fn=>fn},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/services/api':{apiFetch(){throw Error('No network')}}})
  assert.equal(useProductForm().validateForm(),true)
})
test('service form validates unit and precision without a supplier and preserves its kind when editing',()=>{
  const {EMPTY_PRODUCT_FORM}=loadReportModule('../inventory/products/types.ts')
  let state={...EMPTY_PRODUCT_FORM,productKind:'SERVICE',name:'Asesoría',category:'1',price:'100',serviceUnitLabel:'Hora',quantityDecimals:'2'}
  const load=()=>loadReportModule('../inventory/products/hooks/useProductForm.ts',{
    react:{...React,useState:()=>[state,value=>{state=value}],useCallback:fn=>fn},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/services/api':{getApiBaseUrl:()=>'/api',apiFetch(){throw Error('No real requests')}},
  }).useProductForm()
  assert.equal(load().validateForm(),true)
  state={...state,serviceUnitLabel:''}
  assert.equal(load().validateForm(),false)
  state={...state,serviceUnitLabel:'Hora',quantityDecimals:'5'}
  assert.equal(load().validateForm(),false)
  load().populateFromProduct({name:'Asesoría',kind:'SERVICE',serviceUnitLabel:'Sesión',quantityDecimals:3,category:'1',price:100,cost:0,stock:0,minStock:0},[],[])
  assert.equal(state.productKind,'SERVICE')
  assert.equal(state.serviceUnitLabel,'Sesión')
  assert.equal(state.quantityDecimals,'3')
})
test('new service reuses inventory creation and sends only commercial fields',()=>{
  const nodes=[],writes=[]
  const {EMPTY_PRODUCT_FORM}=loadReportModule('../inventory/products/types.ts')
  const form={...EMPTY_PRODUCT_FORM,productKind:'SERVICE',name:'Asesoría',category:'1',price:'100',serviceUnitLabel:'Hora',quantityDecimals:'2'}
  const Page=loadReportModule('../inventory/products/ProductCreatePage.tsx',{
    '@/context/useTenant':{useTenant:()=>({registerTenantExitGuard:()=>()=>{}})},
    '../units/useUnitCatalog':{useUnitCatalog:()=>({scope:{companyId:'A',branchId:'B'},canWrite:true,units:[]})},
    '@/modules/appointments/useServiceScheduleDraft':{useServiceScheduleDraft:()=>({allowed:false,ready:true,payload:{}})},
    '@/services/api':{getApiBaseUrl:()=>'/api',apiFetch(){throw Error('No real requests')}},
    './api':{getApiBaseUrl:()=>'/api',apiFetch(){throw Error('No real requests')}},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryServicesEnabled:true,locale:'es-GT',currencyCode:'GTQ'})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},
    './hooks':{useProductForm:()=>({formData:form,setFormData(){},validateForm:()=>true,resetForm(){}})},
    '@/hooks/useCreateProduct':{useCreateProduct:()=>({isPending:false,mutate:payload=>writes.push(payload)})},
    '@/hooks/useCategories':{useCategories:()=>({data:[{id:1,name:'Servicios'}]})},
    '@/hooks/useSuppliers':{useSuppliers:()=>({data:{items:[]}})},
    '@/hooks/useExperienceProfile':{useExperienceProfile:()=>({showAdvancedByDefault:false})},
    './hooks/useKitAssemblePrompt':{useKitAssemblePrompt:()=>({promptDialog:null})},
  },nodes).default
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/inventario/nuevo?tipo=services']},React.createElement(Page)))
  assert.match(html,/Unidad de cobro/)
  assert.match(html,/¿Cómo cobras\?/)
  assert.match(html,/Permitir fracciones/)
  assert.doesNotMatch(html,/Stock Inicial|Stock Mínimo|Proveedor \*/)
  nodes.find(node=>node.type==='button' && node.props.children==='Guardar servicio').props.onClick()
  assert.equal(writes[0].kind,'SERVICE')
  assert.equal(writes[0].service_unit_label,'Hora')
  assert.equal(writes[0].quantity_decimals,2)
  for(const field of ['stock','min_stock','cost','supplier_id','tracks_expiry','brand','size'])assert.equal(Object.hasOwn(writes[0],field),false,field)
})

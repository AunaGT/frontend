const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')

function create({service=false,advanced=true}={}){
  const {EMPTY_PRODUCT_FORM}=loadReportModule('../inventory/products/types.ts')
  const form={...EMPTY_PRODUCT_FORM,productKind:service?'SERVICE':'STANDARD',serviceUnitLabel:'Hora',quantityDecimals:'2'}
  const nodes=[]
  const Page=loadReportModule('../inventory/products/ProductCreatePage.tsx',{
    '@/context/useTenant':{useTenant:()=>({registerTenantExitGuard:()=>()=>{}})},
    '../units/useUnitCatalog':{useUnitCatalog:()=>({scope:{companyId:'A',branchId:'B'},canWrite:true,units:[]})},
    '@/modules/appointments/useServiceScheduleDraft':{useServiceScheduleDraft:()=>({allowed:false,ready:true,payload:{}})},
    '@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},
    '@/services/api':{getApiBaseUrl:()=>'/api',apiFetch(){throw Error('Unexpected request')}},
    './api':{getApiBaseUrl:()=>'/api',apiFetch(){throw Error('Unexpected request')}},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryUnitsEnabled:true,inventoryServicesEnabled:true,locale:'es-GT',currencyCode:'GTQ'})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},
    './hooks':{useProductForm:()=>({formData:form,setFormData(){},validateForm:()=>false,resetForm(){}})},
    '@/hooks/useCreateProduct':{useCreateProduct:()=>({isPending:false})},
    '@/hooks/useCategories':{useCategories:()=>({data:[]})},
    '@/hooks/useSuppliers':{useSuppliers:()=>({data:{items:[]}})},
    '@/hooks/useExperienceProfile':{useExperienceProfile:()=>({showAdvancedByDefault:advanced})},
    './hooks/useKitAssemblePrompt':{useKitAssemblePrompt:()=>({promptDialog:null})},
  },nodes).default
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[service?'/inventario/nuevo?tipo=services':'/inventario/nuevo']},React.createElement(Page)))
  return {html,nodes}
}
function group(html,id){
  const start=html.search(new RegExp(`<section[^>]*aria-labelledby="${id}"`))
  if(start<0)return ''
  let depth=0
  for(const tag of html.slice(start).matchAll(/<\/?section\b[^>]*>/g)){
    depth+=tag[0].startsWith('</')?-1:1
    if(depth===0)return html.slice(start,start+tag.index+tag[0].length)
  }
  throw Error('Unclosed section '+id)
}
test('product creation groups identity, prices and stock instead of mixing unrelated fields',()=>{
  const {html}=create()
  const identity=group(html,'create-identity-heading'),prices=group(html,'create-prices-heading'),stock=group(html,'create-stock-heading')
  assert.match(identity,/Nombre del Producto|Nombre del producto/)
  assert.match(identity,/Proveedor/);assert.match(identity,/Código de [Bb]arras/)
  assert.doesNotMatch(identity,/Precio mayoreo|Stock Inicial|Stock inicial/)
  assert.match(prices,/Precio de [Vv]enta/);assert.match(prices,/Precio mayoreo/);assert.match(prices,/Precio promoción/)
  assert.match(prices,/Promoción válida hasta/)
  assert.doesNotMatch(prices,/Stock [Ii]nicial|Controla caducidad/)
  assert.match(stock,/Stock [Ii]nicial/);assert.match(stock,/Stock [Mm]ínimo/)
  assert.match(stock,/Unidad de tus existencias/);assert.match(stock,/Controla caducidad/)
  assert.ok(html.indexOf('create-identity-heading')<html.indexOf('create-prices-heading'))
})
test('basic creation keeps required identity and sale price without exposing advanced pricing',()=>{
  const {html}=create({advanced:false})
  assert.match(group(html,'create-identity-heading'),/Proveedor/)
  assert.match(group(html,'create-prices-heading'),/Precio de [Vv]enta/)
  assert.doesNotMatch(html,/Precio mayoreo|Precio promoción|Controla caducidad/)
})
test('service creation keeps billing in prices and never mounts physical stock groups',()=>{
  const {html}=create({service:true})
  assert.match(group(html,'create-prices-heading'),/¿Cómo cobras\?/)
  assert.doesNotMatch(html,/create-stock-heading|Stock [Ii]nicial|Proveedor \*/)
})

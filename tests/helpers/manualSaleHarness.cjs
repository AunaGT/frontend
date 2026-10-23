const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),router=require('react-router-dom')
const {loadReportModule}=require('./loadReportModule.cjs'),{hookHarness}=require('./reportHookHarness.cjs')
const product={id:'P',name:'Producto',price:10.25,kind:'STANDARD',quantityDecimals:0,stock:10}
function manualPage({draft=null,save,confirm,scope={companyId:'A',branchId:'B'},permission=true,scan}={}){
 const h=hookHarness(),nodes=[],writes=[],navigations=[],notices=[]
 let tenant=scope
 const api={assertManualScope(){},readManualSale:async()=>draft,previewManualSale:async()=>({total:'20.50',items:[{unitPrice:'10.25',lineTotal:'20.50'}]}),
  saveManualSale:async(s,id,input)=>{writes.push({kind:'save',s,id,input});return save?save(s,id,input):{...draft,id:'V',reference:'V-001',version:(draft?.version??0)+1,status:'DRAFT',customerId:input.customerId,customerName:input.customerName,customerNit:input.customerNit,total:'20.50',items:[{id:1,productId:'P',name:'Producto',kind:'STANDARD',qty:input.items[0].qty,unitPrice:'10.25',lineTotal:'20.50',unitLabel:'unidad',quantityDecimals:0}]}},
  confirmManualSale:async(s,id,input)=>{writes.push({kind:'confirm',s,id,input});return confirm?confirm():{...draft,status:'CONFIRMED'}},cancelManualSale:async()=>({...draft,status:'CANCELLED'})}
 const originalWindow=global.window;global.window={...originalWindow,addEventListener(){},removeEventListener(){},setTimeout:fn=>{queueMicrotask(fn);return 1},clearTimeout(){}}
 const Page=loadReportModule('../sales/ManualSalePage.tsx',{
  react:h.hooks,'react-router-dom':{...router,useParams:()=>({id:draft?.id}),useSearchParams:()=>[new URLSearchParams(),()=>{}],useNavigate:()=>url=>navigations.push(url)},
  '@/context/useTenant':{useTenant:()=>({company:{id:tenant.companyId},branch:tenant.branchId==='all'?null:{id:tenant.branchId,name:'Principal'},isConsolidated:tenant.branchId==='all',registerTenantExitGuard:()=>()=>{}})},
  '@/context/useAuth':{useAuth:()=>({user:{id:'U'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>permission,permissionsReady:true})},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ',salesAllowCredit:true})},'@/hooks/use-toast':{useToast:()=>({toast:n=>notices.push(n)})},
  '@/components/layout/PageNavigation':{usePageTrail(){}},'@/services/authSession':{authSessionIdentity:()=> 'session',authSessionMatches:()=>true},'@/services/api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},
  './manualSalesApi':api,'./components/SavedCustomerMany2One':{SavedCustomerMany2One:()=>null},'@/components/shared/ProductPicker':{ProductPicker:()=>null},
  '@/components/shared/ScannerField':{ScannerField:()=>null},'@/services/contextScannerService':{resolveContextScan:scan??(async()=>({product,presentationId:null,unitRevision:1}))},
  '@/services/productService':{fetchPosCatalogItems:async()=>({items:[product],missingIds:[]}),adaptApiProduct:p=>p},
  '../appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
  '@tanstack/react-query':{useQuery:()=>({data:{total:'20.50',items:[{unitPrice:'10.25',lineTotal:'20.50'}]},isFetching:false,isError:false}),useQueryClient:()=>({invalidateQueries(){}})},
 },nodes).default
 const render=()=>{nodes.length=0;const tree=h.render(()=>Page());return{html:renderToStaticMarkup(React.createElement(router.MemoryRouter,null,tree)),nodes}}
 return{render,writes,navigations,notices,product,setTenant:s=>tenant=s,cleanup:()=>{h.unmount();global.window=originalWindow}}
}
module.exports={manualPage,product}

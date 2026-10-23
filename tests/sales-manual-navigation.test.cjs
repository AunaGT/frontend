const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),router=require('react-router-dom'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('Ventas exposes separate manual creation and POS actions with distinct destinations',()=>{
 const nodes=[],navigations=[],data={filters:{searchTerm:'',statusFilter:'all',paymentFilter:'all',period:'all'},sales:[],pageInfo:{page:1,totalPages:1,totalItems:0},pageSize:50,pageSizeOptions:[25,50,100],viewMode:'table',totalSalesToday:0,transactionCountToday:0,averageTicketToday:0,draftCount:0,draftTotal:0}
 const Page=loadReportModule('../sales/SalesManagement.tsx',{
  'react-router-dom':{...router,useNavigate:()=>path=>navigations.push(path)},
  './hooks':{useSalesData:()=>data},'@/context/useAuth':{useAuth:()=>({isAuthenticated:true,user:{id:'U'}})},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},
  '@/context/useModules':{useModules:()=>({isEnabled:()=>false})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},
  '@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[]})},'@/hooks/useRealtimeSales':{useRealtimeSales(){}},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/services/api':{getApiBaseUrl:()=>'',getAuthToken:()=>null},'./api':{getApiBaseUrl:()=>'',getAuthToken:()=>null},
 },nodes).default
 const html=renderToStaticMarkup(React.createElement(router.MemoryRouter,null,React.createElement(Page)));assert.match(html,/Abrir POS/);assert.match(html,/Nueva venta/)
 const label=node=>React.Children.toArray(node.props.children).filter(c=>typeof c==='string').join('').trim()
 const buttons=nodes.filter(n=>typeof n.props.onClick==='function')
 buttons.find(n=>label(n)==='Abrir POS').props.onClick();buttons.find(n=>label(n)==='Nueva venta').props.onClick()
 assert.deepEqual(navigations,['/ventas/pos','/ventas/nueva'])
})
test('a creator can reopen a permitted draft from the list without invoice/detail authority',()=>{
 const nodes=[],opened=[]
 const {SalesStatusTable}=loadReportModule('../sales/components/SalesStatusTable.tsx',{},nodes)
 const sale={id:'V',reference:'V-001',date:'2026-10-22T12:00:00Z',customer:'Cliente',status:'draft',total:10,products:[],capabilities:{editManual:true},commercial:{state:'DRAFT'}}
 renderToStaticMarkup(React.createElement(SalesStatusTable,{sales:[sale],viewMode:'table',pageInfo:{page:1,totalPages:1,totalItems:1},pageSize:50,isLoading:false,updatingSaleIds:new Set(),canViewDetail:false,canViewInvoice:false,canChangeStatus:false,onEditManual:s=>opened.push(s.id),onPageChange(){}}))
 const button=nodes.find(n=>n.props['aria-label']==='Editar borrador V-001');assert.ok(button);button.props.onClick();assert.deepEqual(opened,['V'])
})

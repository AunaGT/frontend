const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const context={companyId:'c',branchId:'b',actorId:'u'}
test('closure service sends explicit tenant scope, rejects denied details and cancels stale responses',async()=>{
 const api=loadReportModule('../../services/cashClosureReadService.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>'qa'}})
 const previous=global.fetch;let captured
 try {
  global.fetch=async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({viewOwn:true,viewTeam:false})}}
  assert.deepEqual(await api.fetchCashClosureReadCapabilities(context),{viewOwn:true,viewTeam:false})
  assert.equal(captured.options.headers['X-Company-Id'],'c');assert.equal(captured.options.headers['X-Branch-Id'],'b');assert.equal(captured.options.cache,'no-store')
  await api.fetchCashClosurePage(context,{scope:'mine',page:2,pageSize:20});assert.match(captured.url,/scope=mine/)
  global.fetch=async()=>({ok:false,status:404,json:async()=>({message:'No encontrado'})})
  await assert.rejects(api.fetchCashClosureDetail('foreign',context),e=>e.status===404)
  const abort=new AbortController();global.fetch=async()=>({ok:true,json:async()=>{abort.abort();return {id:'stale'}}})
  await assert.rejects(api.fetchCashClosureDetail('old',context,abort.signal),e=>e.name==='AbortError')
 } finally {global.fetch=previous}
})
function renderHistory(team=false,error=false){
 const nodes=[],queries=[]
 const Page=loadReportModule('../cash-closure/CashClosureManagement.tsx',{
  '@/context/useAuth':{useAuth:()=>({user:{id:'u',role:{name:'vendedor'}}})},
  '@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>null},
  '@/context/useTenant':{useTenant:()=>({company:{id:'c'},branch:{id:'b'}})},
  '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:(...codes)=>codes.some(c=>['cashclosure.view',...(team?['cashclosure.view_team']:[])].includes(c))})},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({timezone:'America/Guatemala',currencyCode:'GTQ',locale:'es-GT'})},
  './hooks':{useMineClosureGate:()=>({gate:{loading:false},refresh(){}}),canRegisterMineClosure:()=>false,mineClosureBlockedHint:()=>'',useCashClosureAPI:()=>({})},
  './CashClosureCreatePage':{CASH_CLOSURE_CREATE_PATH:'/cierre-caja/nuevo'},
  '@/services/cashClosureReadService':{CASH_CLOSURE_READ_PERMISSIONS:['cashclosure.view','cashclosure.view_team','cashclosure.approve','cashclosure.validate']},
  '@tanstack/react-query':{useQuery:options=>{queries.push(options);return options.queryKey[0]==='cash-closure-read-capabilities'?{data:{viewOwn:true,viewTeam:team},isPending:false}:{isError:error,error:error?Error('Sin acceso'):null,isPending:false,data:error?undefined:{items:[{id:'c1',closure_number:12,status:'Aprobado',start_date:'2026-01-01',end_date:'2026-01-02',cashier_name:'Ana',theoretical_total:1,actual_total:1,difference:0}],page:1,totalPages:2,summary:{total:21}}}}},
 },nodes).default
 return {html:renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page))),nodes,queries}
}
test('cashiers and custom team readers both keep filters and pagination without role-name rules',()=>{
 const own=renderHistory();assert.match(own.html,/Mis arqueos/);assert.doesNotMatch(own.html,/aria-label="Alcance de arqueos"/);assert.match(own.html,/Paginación de arqueos/);assert.match(own.html,/Filtros de arqueos/)
 const team=renderHistory(true);assert.match(team.html,/aria-label="Alcance de arqueos"/);assert.match(team.html,/Equipo/);assert.match(team.html,/Página siguiente/)
 assert.doesNotMatch(team.html,/Pedir reconteo|>Aprobar<|>Finalizar</)
 for(const options of team.queries)assert.ok(options.queryKey.includes('c')&&options.queryKey.includes('b')&&options.queryKey.includes('u'))
 assert.doesNotMatch(renderHistory(false,true).html,/Arqueo #12/)
})
test('a valid historical closure with a null difference percentage remains readable',()=>{
 const Page=loadReportModule('../cash-closure/ClosureDetailPage.tsx',{
  '@/services/cashClosureReadService':{CASH_CLOSURE_READ_PERMISSIONS:['cashclosure.view']},'@/services/cashReviewService':{},'@/services/cashCorrectionService':{},
  '@/context/useTenant':{useTenant:()=>({company:{id:'c'},branch:{id:'b'}})},
  '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'u'},hasPermission:(...codes)=>codes.includes('cashclosure.view')})},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ',locale:'es-GT'})},'@/components/layout/PageNavigation':{usePageTrail(){}},
  '@/hooks/use-toast':{useToast:()=>({toast(){}})},'./hooks':{useCashClosureAPI:()=>({})},'./generatePDF':{},'@/utils/pdfBranding':{},
  'react-router-dom':{useParams:()=>({id:'c1'}),useNavigate:()=>()=>{},Link:'a'},
  '@tanstack/react-query':{useQuery:({queryKey})=>({isPending:false,data:queryKey[0]==='cash-closure-detail'?{id:'c1',closure_number:1,status:'Aprobado',cashier_name:'Ana',start_date:'2026-01-01',end_date:'2026-01-02',actual_total:0,theoretical_total:0,difference:0,difference_percentage:null,payment_breakdowns:[],denominations:[]}:null}),useQueryClient:()=>({})},
 }).ClosureDetailPage
 assert.match(renderToStaticMarkup(React.createElement(Page)),/Porcentaje no disponible/)
})

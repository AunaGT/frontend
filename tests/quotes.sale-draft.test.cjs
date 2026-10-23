const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
function page(extra={}){
 const h=hookHarness(),nodes=[],navigations=[],mutations=[]
 const quote={id:'q',branch_id:'B',doc_type:'QUOTE',status:'ACCEPTED',created_at:'2026-10-22T12:00Z',total:'20.50',lines:[],convertedChildren:[],...extra}
 const Page=loadReportModule('../quotes/QuoteDetailPage.tsx',{
  react:h.hooks,'react-router-dom':{useParams:()=>({id:'q'}),useNavigate:()=>path=>navigations.push(path),useLocation:()=>({hash:''})},
  '@tanstack/react-query':{useQuery:()=>({data:quote}),useMutation:options=>{const m={options,mutate:variables=>{m.variables=variables;mutations.push(m)},isPending:false};return m},useQueryClient:()=>({setQueryData(){},invalidateQueries(){}})},
  '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},isConsolidated:false})},
  '@/context/useModules':{useModules:()=>({isEnabled:()=>true})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},
  '@/services/authSession':{authSessionIdentity:()=> 'session'},
  '@/services/api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},'./api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},
 },nodes).default
 h.render(()=>Page());return{nodes,navigations,mutations}
}
test('accepted quotation offers explicit draft conversion and opens the returned stable draft',()=>{
 const h=page();assert.equal(h.mutations.length,0)
 const action=h.nodes.find(n=>n.props['aria-label']==='Crear borrador de venta');assert.ok(action);action.props.onClick()
 assert.equal(h.mutations.length,1);h.mutations[0].options.onSuccess({id:'v',status:'DRAFT'},h.mutations[0].variables)
 assert.deepEqual(h.navigations,['/ventas/v/editar'])
})
test('linked direct sale hides duplicate conversion, scheduling and quotation cancellation',()=>{
 const h=page({hasDirectSale:true,directSale:{id:'v',reference:'V-1',status:'DRAFT'},agenda:{canCreate:true}})
 assert(!h.nodes.some(n=>n.props['aria-label']==='Crear borrador de venta'))
 assert(!h.nodes.some(n=>n.props['aria-label']==='Agendar servicios'))
 const action=h.nodes.find(n=>n.props['aria-label']==='Ver venta vinculada');assert.ok(action);action.props.onClick();assert.deepEqual(h.navigations,['/ventas/v/editar'])
})
test('quote sale transport freezes tenant headers and refuses responses after a session change',async()=>{
 let session='session';const calls=[]
 const api=loadReportModule('../../services/quoteService.ts',{'./api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:async(path,options)=>{calls.push({path,options});return{id:'v',status:'DRAFT'}}},'./authSession':{authSessionIdentity:()=>session}})
 const scope={companyId:'A',branchId:'B',sessionIdentity:'session'}
 await api.convertQuoteToSale('quote',scope);assert.equal(calls[0].path,'/api/quotes/quote/convert-to-sale');assert.deepEqual(calls[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'})
 session='changed';await assert.rejects(api.convertQuoteToSale('quote',scope),{name:'AbortError'});assert.equal(calls.length,1)
 const stale=loadReportModule('../../services/quoteService.ts',{'./api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:async()=>{session='changed';return{id:'v'}}},'./authSession':{authSessionIdentity:()=>session}})
 session='session';await assert.rejects(stale.convertQuoteToSale('quote',scope),{name:'AbortError'})
})

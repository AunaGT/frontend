const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('an accepted quotation opens its existing engagement and a new one enters explicit preparation',()=>{
  const {quoteAgendaDestination}=loadReportModule('../quotes/quoteViewModel.mjs')
  assert.equal(typeof quoteAgendaDestination,'function')
  assert.equal(quoteAgendaDestination({id:'quote',status:'ACCEPTED',engagementId:'engagement'}),'/agenda/contrataciones/engagement')
  assert.equal(quoteAgendaDestination({id:'quote',status:'ACCEPTED'}),'/agenda/contrataciones/nueva?cotizacion=quote')
})
test('the quote detail agenda action navigates to its existing engagement without creating on mount or click',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],destinations=[],writes=[]
  const quote={id:'q',doc_type:'QUOTE',status:'ACCEPTED',created_at:'2026-10-13T12:00Z',total:'175.00',lines:[{id:'l',item_kind:'SERVICE',item_name:'Show',unit_label:'Evento',qty:'1',unit_price:'175',line_total:'175'}],engagementId:'e',agenda:{canOpen:true,canCreate:false,reason:''},convertedChildren:[]}
  const Page=loadReportModule('../quotes/QuoteDetailPage.tsx',{
    react:h.hooks,'react-router-dom':{useParams:()=>({id:'q'}),useNavigate:()=>path=>destinations.push(path),useLocation:()=>({hash:''})},
    '@tanstack/react-query':{useQuery:()=>({data:quote}),useMutation:()=>({mutate:()=>writes.push('mutation')}),useQueryClient:()=>({setQueryData(){},invalidateQueries(){}})},
    '@/context/useTenant':{useTenant:()=>({company:{id:'company'},branch:{id:'branch'},isConsolidated:false})},
    '@/context/useModules':{useModules:()=>({isEnabled:()=>true})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ',companyName:'QA'})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/services/api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},
    './api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},
  },nodes).default
  h.render(()=>Page())
  assert.deepEqual(writes,[])
  const action=nodes.find(n=>n.props['aria-label']==='Ver contratación')
  assert.ok(action,'the approved agenda action must be available')
  action.props.onClick();assert.deepEqual(destinations,['/agenda/contrataciones/e']);assert.deepEqual(writes,[])
})

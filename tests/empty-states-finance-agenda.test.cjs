const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const art=/\/illustrations\/empty-states\/workspace-flat.png/

test('agenda history empty is compact and read-only, while existing events remain intact',()=>{
  const {AgendaHistory}=loadReportModule('../appointments/components/AgendaHistory.tsx')
  const render=history=>renderToStaticMarkup(React.createElement(AgendaHistory,{history,timezone:'America/Guatemala'}))
  const empty=render({items:[],hasMore:false})
  assert.match(empty,art);assert.match(empty,/width="96" height="64"/)
  assert.doesNotMatch(empty,/<button|<a\s/)
  const populated=render({items:[{id:'event',action:'CREATED',at:'2026-10-16T12:00:00Z',actor:'Ana',reason:'Primera reserva'}],hasMore:false})
  assert.match(populated,/Primera reserva/);assert.doesNotMatch(populated,art)
})

test('supplier entries empty explains the source without inventing a payment or purchase',()=>{
  const {PayableEntries}=loadReportModule('../receivables/components/PayableEntries.tsx',{
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ',locale:'es-GT',timezone:'America/Guatemala'})},
  })
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(PayableEntries,{rows:[]})))
  assert.match(html,art);assert.match(html,/colSpan="10"/i)
  assert.doesNotMatch(html,/<button|<a\s/)
})

test('agenda empty lists preserve create permission, date filters and error feedback; empty calendar stays interactive',()=>{
  const ctx={scope:{companyId:'company',branchId:'branch'},user:{id:'user'},ready:true,writable:true,canUseCatalog:true,timezone:'America/Guatemala',hasPermission:()=>true}
  let result={sessions:[],bookings:{items:[],totalItems:0},isLoading:false,isError:false,refetch(){}}
  const navigations=[],nodes=[]
  const Page=loadReportModule('../appointments/pages/AgendaPage.tsx',{
    'react-router-dom':{...require('react-router-dom'),useNavigate:()=> (...args)=>navigations.push(args)},
    '../useAgendaContext':{useAgendaContext:()=>ctx},'../hooks':{useAgenda:()=>result},
    '@/hooks/use-mobile':{useIsMobile:()=>false},
    '@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({pageSize:50,setPageSize(){}})},
    '@tanstack/react-query':{useQuery:()=>({data:{branches:[],providers:[],resources:[]}})},
    '@/services/api':{apiFetch(){throw Error('No network')}},
    '@/components/layout/PageNavigation':{usePageTrail(){}},
  },nodes).default
  const render=route=>{nodes.length=0;return renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[route]},React.createElement(Page)))}
  const initial=render('/agenda?vista=list')
  assert.match(initial,art);assert.match(initial,/Este período tiene espacio/)
  const empty=nodes.find(n=>n.type?.name==='CollectionEmptyState')
  empty.props.action.props.onClick();assert.equal(navigations[0][0],'/agenda/nueva')
  ctx.writable=false
  assert.doesNotMatch(render('/agenda?vista=list'),/>Agendar<\/button>/)
  const filtered=render('/agenda?vista=list&fecha=2030-01-01')
  assert.match(filtered,/Busquemos por otro lado|Limpiar filtros/)
  assert.doesNotMatch(filtered,/Este período tiene espacio/)
  ctx.writable=true
  const calendar=render('/agenda?vista=week')
  assert.doesNotMatch(calendar,art)
  assert.equal(typeof nodes.find(n=>n.type?.name==='AgendaCalendar').props.onSelect,'function')
  result={...result,isError:true,error:Error('Conexión interrumpida')}
  assert.doesNotMatch(render('/agenda?vista=list'),art)
  assert.match(render('/agenda?vista=list'),/Reintentar/)
})

const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('Agenda registrada, opt-in y deep links pertenecen al mismo módulo',()=>{
  global.window={};global.localStorage={getItem:()=>JSON.stringify({permissions:['appointments.view']})}
  try {
    const {findModuleForPath,getVisibleModules}=loadReportModule('../../config/appModules.ts')
    assert.equal(findModuleForPath('/agenda/reservas/id')?.id,'appointments')
    assert.equal(getVisibleModules(new Set(['inventory'])).some(m=>m.id==='appointments'),false)
    assert.equal(getVisibleModules(new Set(['appointments'])).some(m=>m.id==='appointments'),true)
  } finally {delete global.window;delete global.localStorage}
})
test('lista compacta usa estadísticas antes del filtro y paginación fuera de tabla',()=>{
  const nodes=[]
  const Page=loadReportModule('../appointments/pages/AgendaPage.tsx',{
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},ready:true,writable:true,timezone:'America/Guatemala',hasPermission:()=>true})},
    '../hooks':{useAgenda:()=>({bookings:{items:[],totalItems:0,page:1,pageSize:10},sessions:[],summary:{activities:0,scheduled:0,inProgress:0,completed:0,cancelled:0},isLoading:false,isError:false})},
    '../useServiceScheduleDraft':{emptyDirectory:{branches:[],providers:[],resources:[],employeeCandidates:[]}},
    '@/hooks/use-mobile':{useIsMobile:()=>false},'@tanstack/react-query':{useQuery:()=>({data:{branches:[],providers:[],resources:[],employeeCandidates:[]}})},
    '@/services/api':{apiFetch(){throw Error('No network in SSR')}},
  },nodes).default
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/agenda?vista=list&fecha=2026-10-12']},React.createElement(Page)))
  assert.ok(html.indexOf('metric-strip')<html.indexOf('compact-filter-toolbar'))
  assert.ok(html.indexOf('auna-pagination-outside')>html.indexOf('</table>'))
  assert.match(html,/Agendar/);assert.doesNotMatch(html,/Programar grupo|Reservar servicio|Nueva actividad/);assert.match(html,/Configuración/)
  assert.ok(nodes.some(n=>n.type.name==='AgendaPicker'&&n.props.kind==='services'&&n.props.schedulableOnly===false))
})

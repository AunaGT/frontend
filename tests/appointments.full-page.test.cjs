const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('editing opens its full page and preserves a proposed interval without saving',()=>{
  const {editDestination}=loadReportModule('../appointments/creationDraft.ts',{'@/services/api':{}})
  assert.equal(typeof editDestination,'function')
  const proposed={startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T16:00:00Z'}
  for(const [kind,segment] of [['ACTIVITY','actividades'],['BOOKING','reservas'],['SESSION','sesiones']]){
    assert.deepEqual(editDestination(kind,'qa',proposed),{pathname:`/agenda/${segment}/qa/editar`,state:{proposed}})
  }
})
test('calendar selection and main action navigate directly to complete creation with scoped dates',()=>{
  const nodes=[],navigations=[]
  const Page=loadReportModule('../appointments/pages/AgendaPage.tsx',{
    'react-router-dom':{...require('react-router-dom'),useNavigate:()=> (...args)=>navigations.push(args)},
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},user:{id:'u'},ready:true,writable:true,canUseCatalog:true,timezone:'America/Guatemala',hasPermission:()=>true})},
    '../hooks':{useAgenda:()=>({sessions:[],isLoading:false,isError:false})},
    '../useServiceScheduleDraft':{emptyDirectory:{branches:[],providers:[],resources:[]}},
    '@/hooks/use-mobile':{useIsMobile:()=>false},'@tanstack/react-query':{useQuery:()=>({data:{branches:[],providers:[],resources:[]}})},
    '@/services/api':{apiFetch(){throw Error('No network')}},'@/components/layout/PageNavigation':{usePageTrail(){}}
  },nodes).default
  renderToStaticMarkup(React.createElement(require('react-router-dom').MemoryRouter,null,React.createElement(Page)))
  const calendar=nodes.find(n=>n.type.name==='AgendaCalendar')
  const selected={date:'2030-01-01',startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T16:00:00Z',timezone:'America/Guatemala'}
  calendar.props.onSelect(selected)
  assert.equal(navigations.length,1)
  assert.equal(navigations[0][0],'/agenda/nueva')
  const handoff=navigations[0][1].state.creationDraft
  assert.equal(handoff.scope.companyId,'a');assert.equal(handoff.value.activity.startsAt,selected.startsAt)
  assert.equal(handoff.value.activity.endsAt,selected.endsAt)
  assert.ok(!nodes.some(n=>n.type?.name==='ActivityQuickCreate'))
})
test('the schedule editor is an inline form with the original commercial context, not a modal',()=>{
  const nodes=[]
  const {MoveForm}=loadReportModule('../appointments/components/MoveDialog.tsx',{
    '@tanstack/react-query':{useQuery:()=>({data:[]}),useQueryClient:()=>({invalidateQueries(){}})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},'@/services/api':{}
  },nodes)
  assert.equal(typeof MoveForm,'function')
  const row={id:'qa',serviceName:'Consulta',productId:'p',startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:'America/Guatemala',providerIds:[],resourceIds:[],version:3,commercial:{quantity:'1',unit:'Sesión',unitPrice:'150.00',total:'150.00',currencyCode:'GTQ'},schedulingPolicy:{durationMinutes:60,requiresProvider:false,requiresResource:false}}
  const html=renderToStaticMarkup(React.createElement(MoveForm,{scope:{companyId:'a',branchId:'b'},row,kind:'bookings',directory:{providers:[],resources:[]},onClose(){}}))
  assert.match(html,/<form/);assert.match(html,/150.00/);assert.match(html,/Consulta/)
  assert.ok(!nodes.some(n=>['Dialog','DialogContent'].includes(n.type?.name)))
})
test('editing an activity reviews its before/after schedule in a brief confirmation without saving on submit',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[]
  const {ActivityEditor}=loadReportModule('../appointments/components/ActivityQuickCreate.tsx',{
    react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/services/api':{},
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},writable:true,user:{id:'u'},timezone:'America/Guatemala',hasPermission:()=>true})},
    '../useServiceScheduleDraft':{emptyDirectory:{branches:[],providers:[],resources:[]}},
    '../activityDraft':{...loadReportModule('../appointments/activityDraft.ts',{'@/services/api':{}}),useActivityDraft:()=>({value:{title:'Evento',startsAt:'2030-01-01T16:00Z',endsAt:'2030-01-01T17:00Z',timezone:'America/Guatemala'},pending:false,dirty:true,fields:{},reason:'Cliente',save:()=>writes.push('saved')})},
    '@tanstack/react-query':{useQuery:()=>({data:{branches:[],providers:[],resources:[]}})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})}
  },nodes)
  const row={id:'qa',title:'Evento',startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:'America/Guatemala'}
  const render=()=>{nodes.length=0;h.render(()=>ActivityEditor({row,onClose(){},onSaved(){}}))}
  render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render()
  assert.equal(writes.length,0)
  const confirmation=nodes.find(n=>n.props.title==='Confirmar cambios de programación')
  assert.ok(confirmation);assert.equal(confirmation.props.open,true)
  assert.ok(confirmation.props.description.includes('09:00'))
  assert.ok(confirmation.props.description.includes('10:00'))
  confirmation.props.onConfirm();assert.equal(writes.length,1)
})
test('an assignment refresh error keeps the full editor mounted while started bookings cannot be edited',()=>{
  const ctx={scope:{companyId:'a',branchId:'b'},ready:true,writable:true,timezone:'America/Guatemala',hasPermission:()=>true},nodes=[]
  let row={id:'qa',serviceName:'Consulta',productId:'p',startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:ctx.timezone,providerIds:[],resourceIds:[],version:3,status:'CONFIRMED'}
  const Page=loadReportModule('../appointments/pages/AgendaEditPage.tsx',{
    'react-router-dom':{...require('react-router-dom'),useParams:()=>({id:'qa'})},
    '../useAgendaContext':{useAgendaContext:()=>ctx},'@/components/layout/PageNavigation':{usePageTrail(){}},
    '../useServiceScheduleDraft':{emptyDirectory:{providers:[],resources:[],branches:[]}},'@/services/api':{},
    '@tanstack/react-query':{useQuery:options=>options.queryKey[3]==='edit-bookings'?{data:row}:{data:{providers:[],resources:[],branches:[]},isError:true}},
    '../components/MoveDialog':{MoveForm:()=>React.createElement('form',{'aria-label':'Editor conservado'})}
  },nodes).default
  const render=()=>renderToStaticMarkup(React.createElement(require('react-router-dom').MemoryRouter,null,React.createElement(Page,{kind:'BOOKING'})))
  assert.match(render(),/Editor conservado/)
  row={...row,startsAt:'2020-01-01T15:00Z'};assert.doesNotMatch(render(),/Editor conservado/)
  ctx.writable=false;assert.match(render(),/permiso para editar/)
})

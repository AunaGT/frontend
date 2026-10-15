const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('reprogramar servicio sin personal permite horario manual y duración editable',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[]
  const {MoveForm}=loadReportModule('../appointments/components/MoveDialog.tsx',{react:h.hooks,'./DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},
    './api':{appointmentQueryKey:()=>[],mutateAgenda:async(path,scope,input)=>{writes.push(input);return {id:'b'}}},
    '../api':{appointmentQueryKey:()=>[],getAgenda(){}},
    '@tanstack/react-query':{useQuery:()=>({data:[],refetch(){}}),useQueryClient:()=>({invalidateQueries(){}})}},nodes)
  const row={id:'b',productId:'p',serviceName:'Trabajo',startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T15:45:00Z',timezone:'America/Guatemala',providerIds:[],resourceIds:[],version:1,schedulingPolicy:{durationPolicy:'EDITABLE',requiresProvider:false,requiresResource:false,durationMinutes:45}}
  const render=()=>{nodes.length=0;h.render(()=>MoveForm({scope:{companyId:'A',branchId:'B'},row,kind:'bookings',directory:{providers:[],resources:[]},onClose(){}}))}
  render();const duration=nodes.find(n=>n.props.id==='move-duration'&&n.props.onChange);assert.ok(duration)
  duration.props.onChange({target:{value:'90'}});render()
  nodes.find(n=>n.props.id==='agenda-reason'&&n.props.onChange).props.onChange({target:{value:'Ampliar'}});render()
  const review=nodes.find(n=>n.props.children==='Revisar cambio');assert.equal(review.props.disabled,false)
  nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render();assert.equal(writes.length,0)
  await nodes.find(n=>n.props.title==='Confirmar nuevo horario').props.onConfirm()
  assert.equal(writes[0].endsAt,'2030-01-01T16:30:00.000Z')
})
test('borrador bloquea navegación del router y Atrás; cancelar restaura URL y confirmar navega una sola vez',()=>{
  const {registerDraftNavigation}=loadReportModule('../appointments/components/DraftGuard.tsx')
  const oldWindow=global.window,callbacks=[],routed=[],listeners=new Set();let index=2
  const history={get state(){return {idx:index}},go(delta){index+=delta;let stopped=false;const event={stopImmediatePropagation(){stopped=true}};for(const listener of listeners)listener(event);if(!stopped)routed.push(index)}}
  const navigator={push(to){index++;routed.push(to)},replace(to){routed.push(to)},go:delta=>history.go(delta)}
  global.window={history,addEventListener:(type,fn)=>{if(type==='popstate')listeners.add(fn)},removeEventListener:(type,fn)=>listeners.delete(fn)}
  try{
    const cleanup=registerDraftNavigation(navigator,run=>callbacks.push(run))
    navigator.push('/otra-vista');assert.equal(routed.length,0);callbacks.pop()();assert.deepEqual(routed,['/otra-vista'])
    history.go(-1);assert.equal(index,3);assert.equal(routed.length,1);callbacks.pop()()
    assert.equal(index,2);assert.deepEqual(routed,['/otra-vista',2])
    history.go(-1);assert.equal(index,2);callbacks.pop();assert.equal(routed.length,2)
    navigator.go(-1);assert.equal(routed.length,2);callbacks.pop()();assert.equal(index,1)
    cleanup();navigator.push('/sin-borrador');assert.equal(routed.at(-1),'/sin-borrador');assert.equal(listeners.size,0)
  }finally{if(oldWindow===undefined)delete global.window;else global.window=oldWindow}
})
test('acciones legales distinguen confirmar, atender y cancelar sin pago ficticio',()=>{
  const {bookingActions,sessionActions}=loadReportModule('../appointments/components/AgendaActions.tsx',{'@/services/api':{apiFetch(){}}})
  const allow=()=>true
  assert.deepEqual(bookingActions({status:'PENDING',startsAt:'2030-01-01'},allow,new Date('2026-01-01')).map(a=>a.action),['CONFIRM','CANCEL'])
  assert.equal(bookingActions({status:'EXPIRED'},allow).length,0)
  assert.deepEqual(sessionActions({mode:'INDIVIDUAL',status:'SCHEDULED'},allow),[])
  assert.equal(bookingActions({status:'CONFIRMED',startsAt:'2030-01-01'},p=>p==='appointments.attend',new Date('2026-01-01')).some(a=>a.action==='NO_SHOW'),false)
})
test('editar espera datos/permisos y redirige a la página completa después de resolver',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),nodes=[],changes=[]
  let row
  const booking={id:'booking',productId:'product',contactName:'Cliente',contactId:'contact',serviceName:'Consulta',startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T15:45:00Z',timezone:'America/Guatemala',providerIds:[],resourceIds:[],status:'CONFIRMED',version:1,conflicts:[],commercial:null,notes:null,history:{items:[],hasMore:false}}
  const Page=loadReportModule('../appointments/pages/AppointmentDetailPage.tsx',{
    'react-router-dom':{...require('react-router-dom'),useSearchParams:()=>[new URLSearchParams('editar=1'),value=>changes.push(value)]},
    '@/components/layout/PageNavigation':{usePageTrail(){}},'@/services/api':{apiFetch(){}},
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},ready:true,writable:true,timezone:'America/Guatemala',hasPermission:()=>true})},
    '../useServiceScheduleDraft':{emptyDirectory:{branches:[],providers:[],resources:[]}},
    '@tanstack/react-query':{useQuery:options=>options.queryKey[3]==='booking'?{data:row,isLoading:!row}:{data:options.queryKey[3]==='availability'?[]:{branches:[],providers:[],resources:[]}},useQueryClient:()=>({})},
  },nodes).BookingWorkspace
  const render=()=>{nodes.length=0;return renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page,{id:'booking'})))}
  render();assert.equal(changes.length,0);assert.equal(nodes.some(n=>n.type.name==='MoveDialog'),false)
  row=booking;render();const destination=nodes.find(n=>n.type.name==='Navigate');assert.ok(destination);assert.equal(destination.props.to,'/agenda/reservas/booking/editar');assert.equal(changes.length,0)
})
test('resumen de error recibe foco y descartar solicita confirmación sin guardar',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[];let focused=0,error=null
  const {FormFeedback}=loadReportModule('../appointments/components/FormFeedback.tsx',{react:h.hooks},nodes)
  h.render(()=>FormFeedback({error}));error='Sin conexión';const tree=h.render(()=>FormFeedback({error}));tree.ref.current={focus(){focused++}}
  error='Horario ocupado';h.render(()=>FormFeedback({error}));assert.equal(focused,1)
  const events={},oldWindow=global.window,oldDocument=global.document
  global.window={addEventListener:(name,fn)=>{events[name]=fn},removeEventListener(){}};global.document={addEventListener(){},removeEventListener(){}}
  try {
    const guardHarness=hookHarness();let left=0
    const {useDraftGuard}=loadReportModule('../appointments/components/DraftGuard.tsx',{react:{...guardHarness.hooks,useContext:()=>null},'react-router-dom':{useNavigate:()=>()=>{}}})
    let guard=guardHarness.render(()=>useDraftGuard(true));guard.request(()=>left++);assert.equal(left,0)
    guard=guardHarness.render(()=>useDraftGuard(true));assert.equal(guard.dialog.props.open,true);guard.dialog.props.onConfirm();assert.equal(left,1)
    let prevented=false;events.beforeunload({preventDefault(){prevented=true}});assert.equal(prevented,true)
    guardHarness.unmount()
  }finally{if(oldWindow===undefined)delete global.window;else global.window=oldWindow;if(oldDocument===undefined)delete global.document;else global.document=oldDocument}
})
test('confirmación conserva versión de apertura y no adopta silenciosamente un refetch',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[]
  const {AgendaActions}=loadReportModule('../appointments/components/AgendaActions.tsx',{
    react:h.hooks,'./DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},'./api':{mutateAgenda:async(path,scope,input)=>{writes.push(input);return {id:'b'}}},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},
  },nodes)
  let row={id:'b',status:'PENDING',startsAt:'2030-01-01',version:1}
  const render=()=>{nodes.length=0;h.render(()=>AgendaActions({scope:{companyId:'A',branchId:'B'},row,kind:'bookings',has:()=>true}))}
  render();nodes.find(n=>n.props.children==='Confirmar'&&n.props.onClick).props.onClick();row={...row,version:2};render()
  const confirms=nodes.filter(n=>n.props.children==='Confirmar'&&n.props.onClick)
  await confirms.at(-1).props.onClick();assert.equal(writes[0].expectedVersion,1)
})
test('reprogramación confirma una sola escritura, conserva motivo tras conflicto y usa misma clave al reintentar',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[];let fail=true,closed=0
  const slot={startsAt:'2030-01-01T17:00:00.000Z',endsAt:'2030-01-01T18:00:00.000Z',timezone:'America/Guatemala',providerIds:['p'],resourceIds:[],sessionId:null,remaining:1}
  const {MoveForm}=loadReportModule('../appointments/components/MoveDialog.tsx',{
    react:h.hooks,'./DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},'./api':{appointmentQueryKey:()=>[],mutateAgenda:async(path,scope,input)=>{writes.push({path,input});if(fail)throw Error('Horario ocupado');return {id:'b'}}},
    '@tanstack/react-query':{useQuery:()=>({data:[slot],refetch(){}}),useQueryClient:()=>({invalidateQueries(){}})},
    '../api':{appointmentQueryKey:()=>[],getAgenda(){}},
  },nodes)
  const row={id:'b',productId:'s',serviceName:'Servicio',startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T16:00:00Z',timezone:slot.timezone,providerIds:['p'],resourceIds:[],version:3}
  const render=()=>{nodes.length=0;h.render(()=>MoveForm({scope:{companyId:'A',branchId:'B'},row,kind:'bookings',proposed:slot.startsAt,directory:{providers:[],resources:[]},onClose(){closed++}}))}
  render();nodes.find(n=>n.props.id==='agenda-reason'&&n.props.onChange).props.onChange({target:{value:'Solicitud de cliente'}});render()
  nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render();await nodes.find(n=>n.props.title==='Confirmar nuevo horario').props.onConfirm()
  assert.equal(closed,0);render();assert.equal(nodes.find(n=>n.props.id==='agenda-reason').props.value,'Solicitud de cliente')
  fail=false;nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render();await nodes.find(n=>n.props.title==='Confirmar nuevo horario').props.onConfirm()
  assert.equal(closed,1);assert.equal(writes[0].input.idempotencyKey,writes[1].input.idempotencyKey);assert.equal(writes[0].path,'/bookings/b/move')
})

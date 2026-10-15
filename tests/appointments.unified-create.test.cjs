const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const activity={purpose:'EVENT',title:'Show',startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T16:00:00Z',timezone:'America/Guatemala',organizerId:'user',productId:null,userIds:[],providerIds:[],resourceIds:[],guests:[],venue:{kind:'BRANCH'},estimatedAttendance:80,outboundMinutes:0,setupMinutes:0,teardownMinutes:0,returnMinutes:0,notes:''}
test('elegir franja copia zona de sucursal y comando conserva ese instante',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),nodes=[]
  const {AgendaCreateForm}=loadReportModule('../appointments/components/AgendaCreateForm.tsx',{
    '@/services/api':{},'../useServiceScheduleDraft':{emptyDirectory:{providers:[],resources:[],branches:[],employeeCandidates:[]}},
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},user:{id:'u'},timezone:'America/Guatemala',writable:true,canUseCatalog:true,canUseContacts:true,hasPermission:()=>true})},
    '@tanstack/react-query':{useQuery:options=>({data:options.queryKey[3]==='availability'?[]:{providers:[],resources:[],branches:[],employeeCandidates:[]},isSuccess:true}),useQueryClient:()=>({invalidateQueries(){}})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},
    'react-router-dom':{...require('react-router-dom'),useNavigate:()=>()=>{}},
    '../creationDraft':{...loadReportModule('../appointments/creationDraft.ts',{'@/services/api':{}}),useCreationDraft:()=>({value:{kind:'SERVICE',activity,contactId:'c',quantity:'1',capacity:1,service:{id:'p',mode:'INDIVIDUAL',durationMinutes:60,durationPolicy:'EDITABLE',requiresProvider:true}},change:v=>{selected=v},fields:{},pending:false,handoff(){}})}
  },nodes)
  let selected
  renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(AgendaCreateForm,{onClose(){},onSaved(){}})))
  nodes.find(n=>n.type.name==='SlotPicker').props.onSelect({startsAt:'2030-01-01T14:00:00.000Z',endsAt:'2030-01-01T15:00:00.000Z',timezone:'America/New_York',providerIds:['p'],resourceIds:[]})
  assert.equal(selected.activity.timezone,'America/New_York')
  const {creationCommand}=loadReportModule('../appointments/creationDraft.ts',{'@/services/api':{}})
  assert.equal(creationCommand(selected,selected.service).body.timezone,'America/New_York')
})
test('cambiar zona para programación manual conserva instantes, no cambia horario silenciosamente',()=>{
  const {withCreationTimezone}=loadReportModule('../appointments/creationDraft.ts',{'@/services/api':{}})
  assert.equal(typeof withCreationTimezone,'function')
  const moved=withCreationTimezone({kind:'SERVICE',activity:{...activity,startsAt:'2030-01-01T09:00',endsAt:'2030-01-01T10:00'}},'America/New_York')
  assert.equal(moved.activity.timezone,'America/New_York')
  assert.equal(moved.activity.startsAt,'2030-01-01T15:00:00.000Z')
  assert.equal(moved.activity.endsAt,'2030-01-01T16:00:00.000Z')
})
test('disponibilidad usa la misma duración real en zona con cambio horario',()=>{
  const {creationDuration}=loadReportModule('../appointments/creationDraft.ts',{'@/services/api':{}})
  assert.equal(typeof creationDuration,'function')
  assert.equal(creationDuration({...activity,timezone:'America/New_York',startsAt:'2030-03-10T01:30',endsAt:'2030-03-10T03:30'}),60)
})
test('formulario único permite actividad sin integración de catálogo ni contactos',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const {AgendaCreateForm}=loadReportModule('../appointments/components/AgendaCreateForm.tsx',{
    '@/services/api':{},'../useServiceScheduleDraft':{emptyDirectory:{providers:[],resources:[],branches:[],employeeCandidates:[]}},'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'A',branchId:'B'},user:{id:'u',name:'Ana'},timezone:'America/Guatemala',writable:true,canUseCatalog:false,canUseContacts:false,hasPermission:()=>true})},
    '@tanstack/react-query':{useQuery:()=>({isSuccess:false,isLoading:false}),useQueryClient:()=>({invalidateQueries(){}})},
    './DraftGuard':{useDraftGuard:()=>({dirty:false,dialog:null,request:fn=>fn(),proceed:fn=>fn()})},
    'react-router-dom':{...require('react-router-dom'),useNavigate:()=>()=>{}}
  })
  const html=renderToStaticMarkup(React.createElement(require('react-router-dom').MemoryRouter,null,React.createElement(AgendaCreateForm,{onClose(){},onSaved(){}})))
  assert.match(html,/Reunión u otra actividad/);assert.match(html,/Agendar/);assert.doesNotMatch(html,/Reservar servicio configurado/)
})
test('error conserva borrador y clave; doble envío y cambio de tenant no duplican',async()=>{
  const {creationHarness}=require('./helpers/agendaCreationHarness.cjs'),h=creationHarness()
  h.change({activity})
  const first=h.render().save();await h.render().save();assert.equal(h.writes.length,1)
  h.reject(Error('Conflicto'));await first
  assert.equal(h.render().value.activity.title,'Show')
  const retry=h.render().save();h.reject(Error('Conflicto'));await retry
  assert.equal(h.writes[0].body.idempotencyKey,h.writes[1].body.idempotencyKey)
  const late=h.render().save();h.scope({companyId:'C',branchId:'D'});h.resolve({id:'old'});await late
  assert.deepEqual(h.saved,[]);assert.equal(h.render().value.productId,'');assert.equal(h.render().value.activity.title,'')
})
test('una creación distingue reunión, WORK, sesión y reserva sin filtrar estado UI',()=>{
  const {creationCommand}=loadReportModule('../appointments/creationDraft.ts',{'@/services/api':{}})
  const value={kind:'ACTIVITY',activity,productId:'show',contactId:'c',contactName:'Nombre',quantity:'1',capacity:5}
  assert.equal(creationCommand(value,null).path,'/activities')
  const work=creationCommand({...value,kind:'SERVICE'},{id:'show',schedulingStyle:'WORK',durationPolicy:'EDITABLE',durationMinutes:60})
  assert.equal(work.path,'/activities');assert.equal(work.body.serviceScheduling,'CONFIGURED');assert.equal('quantity' in work.body,false)
  const group=creationCommand({...value,kind:'SERVICE'},{id:'class',mode:'GROUP',durationPolicy:'EDITABLE',durationMinutes:60})
  assert.equal(group.path,'/sessions');assert.equal('organizerId' in group.body,false);assert.equal('contactId' in group.body,false)
  const booking=creationCommand({...value,kind:'SERVICE'},{id:'one',mode:'INDIVIDUAL',durationPolicy:'EDITABLE',durationMinutes:60})
  assert.equal(booking.path,'/bookings');assert.equal(booking.body.contactId,'c');assert.equal('contactName' in booking.body,false)
})
test('seleccionar servicio conserva rango y asignaciones; fijo requiere resolver diferencia',()=>{
  const {selectCreationService,creationCommand}=loadReportModule('../appointments/creationDraft.ts',{'@/services/api':{}})
  const draft={kind:'SERVICE',activity:{...activity,providerIds:['previous']},productId:'',contactId:'c',quantity:'1',capacity:1}
  const selected=selectCreationService(draft,{id:'one',name:'Consulta',mode:'INDIVIDUAL',durationPolicy:'FIXED',durationMinutes:45,beforeMinutes:10})
  assert.equal(selected.activity.endsAt,activity.endsAt);assert.deepEqual(selected.activity.providerIds,['previous']);assert.equal(selected.activity.setupMinutes,10)
  assert.throws(()=>creationCommand(selected,selected.service),/fija/i)
})

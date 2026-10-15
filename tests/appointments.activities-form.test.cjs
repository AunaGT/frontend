const test=require('node:test'),assert=require('node:assert/strict')
const {renderActivityForm}=require('./helpers/activityFormHarness.cjs')
const valid={title:'Reunión de equipo',startsAt:'2030-01-01T15:00:00.000Z',endsAt:'2030-01-01T16:00:00.000Z'}
test('copiar dirección de contacto requiere confirmación y deja copia editable',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],{loadReportModule}=require('./helpers/loadReportModule.cjs')
  const {ActivityParticipants}=loadReportModule('../appointments/components/ActivityParticipants.tsx',{react:h.hooks,'../api':{},'@tanstack/react-query':{useQuery:()=>({isSuccess:false})}},nodes)
  let value={userIds:[],guests:[],venue:{kind:'HOME',address:'Original'}}
  const render=()=>{nodes.length=0;h.render(()=>ActivityParticipants({scope:{companyId:'a',branchId:'b'},value,onChange:v=>{value=v},canUseContacts:true}))}
  render();nodes.find(n=>n.type.name==='AgendaPicker').props.onSelect({id:'c',name:'Ana',address:'Casa QA'})
  render();assert.equal(value.venue.address,'Original')
  nodes.find(n=>n.props.children==='Usar dirección del contacto'&&n.props.onClick).props.onClick();render()
  const confirm=nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open);assert.ok(confirm)
  confirm.props.onConfirm();assert.equal(value.venue.address,'Casa QA');assert.equal(value.guests[0].contactId,'c')
})
test('trabajo fijo recalcula fin al editar inicio y conserva marcador de reglas',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),nodes=[]
  const {ActivityFields}=loadReportModule('../appointments/components/ActivityFields.tsx',{'@/services/api':{},'@tanstack/react-query':{useQuery:()=>({isSuccess:false})}},nodes)
  const value={...valid,purpose:'EVENT',organizerId:'u',timezone:'America/Guatemala',venue:{kind:'BRANCH'},userIds:[],resourceIds:[],providerIds:[],guests:[],productId:'p',estimatedAttendance:80,outboundMinutes:0,setupMinutes:0,teardownMinutes:0,returnMinutes:0,notes:'',serviceScheduling:'CONFIGURED'}
  let changed
  renderToStaticMarkup(React.createElement(ActivityFields,{scope:{companyId:'a',branchId:'b'},value,onChange:v=>{changed=v},pending:false,errors:{},capabilities:{catalog:false,contacts:false,notes:false},directory:{providers:[],resources:[],branches:[],employeeCandidates:[]},policy:{durationPolicy:'FIXED',durationMinutes:45}}))
  nodes.find(n=>n.type.name==='ActivityDateTime'&&n.props.id==='activity-startsAt').props.onChange('2030-01-01T16:00:00Z')
  assert.equal(changed.endsAt,'2030-01-01T16:45:00.000Z');assert.equal(changed.serviceScheduling,'CONFIGURED')
})
test('reunión sin servicio ni cliente guarda una actividad, no una reserva',async()=>{
  const page=renderActivityForm({api:async()=>({id:'created'})});page.change(valid)
  await page.submit()
  assert.equal(page.writes[0].path,'/activities');assert.equal(page.writes[0].body.productId,null)
  assert.deepEqual(page.writes[0].body.guests,[]);assert.equal('quantity' in page.writes[0].body,false)
  assert.deepEqual(page.navigations,['/agenda/actividades/created'])
})
test('evento con80 invitados no fabrica participantes y traspaso completo conserva borrador',()=>{
  const page=renderActivityForm();page.change({...valid,purpose:'EVENT',estimatedAttendance:80,notes:'Mantener',venue:{kind:'HOME',address:'Casa del cliente'}})
  const handoff=page.handoff()
  assert.deepEqual(handoff.scope,{companyId:'A',branchId:'B'});assert.deepEqual(handoff.value,page.value())
  assert.deepEqual(handoff.value.guests,[]);assert.equal(handoff.value.estimatedAttendance,80)
})
test('conflicto conserva datos y clave; doble envío se bloquea',async()=>{
  const page=renderActivityForm();page.change(valid)
  const first=page.submit();await page.submit();assert.equal(page.writes.length,1)
  page.rejectSubmit(Error('Horario ocupado'));await first
  assert.equal(page.value().title,valid.title)
  const retry=page.submit();page.rejectSubmit(Error('Horario ocupado'));await retry
  assert.equal(page.writes[0].body.idempotencyKey,page.writes[1].body.idempotencyKey)
})
test('cambio de empresa descarta respuesta y borrador de la anterior',async()=>{
  const page=renderActivityForm();page.change(valid)
  const pending=page.submit();page.changeScope({companyId:'C',branchId:'D'})
  page.resolveSubmit({id:'old'});await pending
  assert.deepEqual(page.navigations,[]);assert.equal(page.value().title,'')
})
test('nombres internos viajan al formulario completo pero no se envían como campos a la API',async()=>{
  const page=renderActivityForm({api:async()=>({id:'a'})});page.change({...valid,userIds:['ana'],userNames:{ana:'Ana Gómez'}})
  assert.equal(page.handoff().value.userNames.ana,'Ana Gómez')
  await page.submit();assert.equal('userNames' in page.writes[0].body,false)
})
test('sala seleccionada sigue visible y se puede quitar al pasar a domicilio',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),nodes=[]
  const {ActivityFields}=loadReportModule('../appointments/components/ActivityFields.tsx',{'@/services/api':{apiFetch(){}},'@tanstack/react-query':{useQuery:()=>({isSuccess:false})}},nodes)
  const value={...valid,purpose:'EVENT',organizerId:'u',timezone:'America/Guatemala',venue:{kind:'HOME',address:'Casa'},userIds:[],resourceIds:['room'],providerIds:[],guests:[],productId:null,estimatedAttendance:80,outboundMinutes:0,setupMinutes:0,teardownMinutes:0,returnMinutes:0,notes:''}
  let changed
  renderToStaticMarkup(React.createElement(ActivityFields,{scope:{companyId:'a',branchId:'b'},value,onChange:v=>{changed=v},pending:false,errors:{},capabilities:{catalog:false,contacts:false,notes:false},directory:{providers:[],resources:[{id:'room',name:'Sala',type:'ROOM',active:true,portable:false}],branches:[],employeeCandidates:[]}}))
  const choices=nodes.find(n=>n.type.name==='AssignmentChoices'&&n.props.label==='Salas y equipos')
  assert.equal(choices.props.items[0].id,'room');choices.props.onChange([])
  assert.deepEqual(changed.resourceIds,[])
})
test('reserva configurada conserva propuesta y muestra diferencia de duración',()=>{
  const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{configuredBookingProposal}=loadReportModule('../appointments/viewModel.ts')
  const p=configuredBookingProposal('2030-01-01T15:00:00Z','2030-01-01T16:00:00Z',30)
  assert.equal(p.requestedMinutes,60);assert.equal(p.proposedEnd,'2030-01-01T15:30:00.000Z');assert.equal(p.durationMismatch,true)
})

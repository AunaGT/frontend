const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('default activity remains manual and its optional AUTO policy survives payload and edit round trip',()=>{
  const {newActivity,activityPayload,activityFromDto}=loadReportModule('../appointments/activityDraft.ts',{'./api':{}})
  const original=newActivity('u','America/Guatemala',{title:'Evento',startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z'})
  assert.equal(original.completionPolicy,'MANUAL')
  const auto={...original,completionPolicy:'AUTO'}
  assert.equal(activityPayload(auto).completionPolicy,'AUTO');assert.equal(activityFromDto({...auto,id:'a',participants:[]}).completionPolicy,'AUTO')
})
test('advanced completion control explains that automatic closure requires start and does not confirm service delivery',()=>{
  let Component
  try{Component=loadReportModule('../appointments/components/ActivityFields.tsx',{'@/services/api':{}}).CompletionPolicyField}catch(e){if(e.code!=='ENOENT')throw e}
  assert.equal(typeof Component,'function')
  const html=renderToStaticMarkup(React.createElement(Component,{value:'MANUAL',onChange(){},disabled:false,id:'activity-completion'}))
  assert.match(html,/iniciad/);assert.match(html,/prestación|realización/);assert.match(html,/Manual/)
})
test('only a real automatically closed activity offers the human commercial confirmation action',()=>{
  const {activityActions}=loadReportModule('../appointments/components/AgendaActions.tsx',{'./api':{}})
  const row={status:'COMPLETED',startsAt:'2030-01-01T15:00Z',completionPolicy:'AUTO',actualCompletedAt:'2030-01-01T16:01Z',commercialCompletionConfirmedAt:null}
  assert.deepEqual(activityActions(row,()=>true).map(a=>a.action),['CONFIRM_COMPLETION'])
  assert.deepEqual(activityActions({...row,commercialCompletionConfirmedAt:'2030-01-01T16:02Z'},()=>true),[])
  assert.deepEqual(activityActions(row,()=>false),[])
})
test('the calendar describes overdue scheduling without turning it into a completed service',()=>{
  const {entryStatusText}=loadReportModule('../appointments/viewModel.ts')
  assert.equal(typeof entryStatusText,'function')
  assert.match(entryStatusText({status:'SCHEDULED',endsAt:'2030-01-01T16:00Z'},new Date('2030-01-01T17:00Z')),/Horario terminado/)
  assert.equal(entryStatusText({status:'COMPLETED',endsAt:'2030-01-01T16:00Z'},new Date('2030-01-01T17:00Z')),'Finalizada')
})
test('selecting a configured WORK retains its closing policy in the review and outgoing draft',()=>{
  const {selectCreationService}=loadReportModule('../appointments/creationDraft.ts',{'./api':{}})
  const service={id:'s',name:'Show',schedulingStyle:'WORK',completionPolicy:'AUTO'}
  const value=selectCreationService({activity:{title:'',completionPolicy:'MANUAL'}},service)
  assert.equal(value.activity.completionPolicy,'AUTO')
})

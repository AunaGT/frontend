const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const t=()=>({schemaVersion:1,milestones:[],attendanceWindows:[],requirementWindows:[]})
const session={startsAt:'2030-01-01T18:00:00Z',endsAt:'2030-01-01T22:00:00Z',timezone:'UTC',organizerId:'u1',userIds:[],providerIds:['p1'],resourceIds:['r1'],outboundMinutes:10,setupMinutes:15,teardownMinutes:15,returnMinutes:10}
const directory={operationalTimelineEnabled:true,providers:[{id:'p1',name:'Artista',active:true,userId:'u2'}],resources:[{id:'r1',name:'Equipo',active:true,type:'EQUIPMENT',portable:true}],branches:[],employeeCandidates:[]}
test('a new activity and old DTO both have a usable empty timeline; payload removes only UI draft data',()=>{
 const {newActivity,activityFromDto,activityPayload}=loadReportModule('../appointments/activityDraft.ts',{'./hooks':{}})
 assert.deepEqual(newActivity('u1','UTC').operationalTimeline,t())
 const base={...newActivity('u1','UTC'),...session,title:'Evento',participants:[]};delete base.operationalTimeline
 assert.deepEqual(activityFromDto(base).operationalTimeline,t())
 const timeline=t();timeline.milestones.push({id:'m1',name:'Bienvenida',startOffsetMinutes:60,endOffsetMinutes:90})
 const draft={...base,operationalTimeline:timeline}
 assert.deepEqual(activityPayload(draft).operationalTimeline,timeline)
 timeline.milestones[0].startInput='2030-01-01T'
 assert.throws(()=>activityPayload(draft),/Completa.*Bienvenida/i)
 assert.equal(timeline.milestones[0].startInput,'2030-01-01T','invalid draft remains intact')
})
test('span editing retains incomplete dates, moves complete offsets and rejects shortening',()=>{
 const {updateTimelineSpan,timelineSpanInstant,timelinePayload}=loadReportModule('../appointments/operationalTimeline.ts')
 const span={id:'m1',name:'Bienvenida',startOffsetMinutes:60,endOffsetMinutes:90}
 const partial=updateTimelineSpan(span,'start','2030-01-01T',session)
 assert.equal(partial.startInput,'2030-01-01T');assert.equal(partial.endOffsetMinutes,90)
 const valid=updateTimelineSpan(partial,'start','2030-01-01T19:00',session)
 assert.equal(valid.startOffsetMinutes,60);assert.ok(!Object.hasOwn(valid,'startInput'))
 assert.equal(timelineSpanInstant(valid,'start',{...session,startsAt:'2030-01-02T18:00:00Z'}),'2030-01-02T19:00:00.000Z')
 assert.throws(()=>timelinePayload({...t(),milestones:[span]},{...session,endsAt:'2030-01-01T19:00:00Z'}),/fuera del evento/)
})
test('timeline editor adds a named focus target and makes custom margins explicit',()=>{
 const changes=[],nodes=[],{OperationalTimelineFields}=loadReportModule('../appointments/components/OperationalTimelineFields.tsx',{},nodes)
 const html=renderToStaticMarkup(React.createElement(OperationalTimelineFields,{value:t(),onChange:v=>changes.push(v),session,directory,disabled:false,errors:{}}))
 assert.match(html,/Momentos del evento/);assert.match(html,/Todo el evento/);assert.doesNotMatch(html,/role="dialog"/)
 nodes.find(n=>n.props.children?.includes?.('Agregar momento')).props.onClick()
 assert.equal(changes.at(-1).milestones.length,1)
 const select=nodes.find(n=>n.props['aria-label']==='Horario de Artista'&&n.props.onValueChange)
 select.props.onValueChange('CUSTOM')
 assert.equal(changes.at(-1).attendanceWindows[0].marginsReviewed,false)
 assert.equal(changes.at(-1).attendanceWindows[0].setupMinutes,15)
 const {timelinePayload}=loadReportModule('../appointments/operationalTimeline.ts')
 assert.throws(()=>timelinePayload(changes.at(-1),session),/Revisa.*traslado/)
})
test('a short attendance is not shown as a full-time requirement already covered',()=>{
 const {AssignmentRequirementsStatus}=loadReportModule('../appointments/components/AssignmentRequirementsFields.tsx')
 const timeline={...t(),attendanceWindows:[{kind:'PROVIDER',entityId:'p1',startOffsetMinutes:60,endOffsetMinutes:90,outboundMinutes:0,setupMinutes:0,teardownMinutes:0,returnMinutes:0}]}
 const html=renderToStaticMarkup(React.createElement(AssignmentRequirementsStatus,{requirements:[{id:'req',name:'Atención permanente',kind:'PROVIDER',quantity:1,optionIds:['p1']}],providerIds:['p1'],resourceIds:['r1'],directory,session,timeline}))
 assert.match(html,/0 de 1.*horario compatible/);assert.match(html,/Todo el evento/)
})
test('read-only timeline uses disabled system controls and errors are visible next to its section',()=>{
 const nodes=[],{OperationalTimelineFields}=loadReportModule('../appointments/components/OperationalTimelineFields.tsx',{},nodes)
 const html=renderToStaticMarkup(React.createElement(OperationalTimelineFields,{value:t(),onChange(){throw Error('write')},session,directory,disabled:true,errors:{'operationalTimeline.milestones':'Revisa los momentos'}}))
 assert.match(html,/Revisa los momentos/)
 assert.ok(nodes.filter(n=>n.type?.displayName==='Button').every(n=>n.props.disabled))
})
test('engagement retry/context refresh retains private timeline drafts, but another company gets no copy',async()=>{
 const h=require('./helpers/reportHookHarness.cjs').hookHarness(),writes=[]
 const {useEngagementDraft}=loadReportModule('../appointments/engagementDraft.ts',{react:h.hooks,'./hooks':{useAgendaMutation:()=>({pending:false,error:null,fields:{},submit:async(...args)=>{writes.push(args);return null}})}})
 let scope={companyId:'a',branchId:'b'},initial=[{lineId:'l1',quantity:'1',...session,operationalTimeline:t()}]
 const render=()=>h.render(()=>useEngagementDraft({scope,engagementId:'e1',version:1,initial,onSaved(){}}))
 const changed={...initial[0],operationalTimeline:{...t(),milestones:[{id:'m1',name:'Bienvenida',startOffsetMinutes:0,endOffsetMinutes:30,startInput:'2030-01-01T'}]}}
 render().change([changed]);render().reviewVersion(2);await render().save(false)
 assert.equal(writes.length,0);assert.match(render().error,/Completa/);assert.equal(render().programs[0].operationalTimeline.milestones[0].startInput,'2030-01-01T')
 const previousScope=scope;scope={companyId:'other',branchId:'b'};assert.equal(render().error,null);scope=previousScope
 render().change([changed]);render().reviewVersion(2)
 const complete=structuredClone(changed);delete complete.operationalTimeline.milestones[0].startInput
 render().change([complete]);await render().save(false);await render().save(false)
 assert.equal(writes.length,2);assert.equal(writes[0][1].idempotencyKey,writes[1][1].idempotencyKey)
 assert.equal(writes[0][1].expectedVersion,2);assert.deepEqual(writes[0][1].programs[0].operationalTimeline,complete.operationalTimeline)
 scope={companyId:'other',branchId:'b'};assert.deepEqual(render().programs,[])
})
test('public mode survives safe projection, while internal timeline and option IDs never do',()=>{
 const {publicServiceConditions,serviceConditionText}=loadReportModule('../../services/serviceConditions.ts')
 const value={version:1,schedulingStyle:'WORK',durationPolicy:'EDITABLE',durationMinutes:240,allowedVenueKinds:['EVENT_VENUE'],publicInstructions:'',operationalTimeline:{private:true},assignmentRequirements:[{id:'private',name:'Show',kind:'PROVIDER',quantity:1,optionIds:['private'],attendanceMode:'INTERVENTION'}]}
 const projected=publicServiceConditions(value);assert.equal(projected.assignmentRequirements[0].attendanceMode,'INTERVENTION')
 assert.match(serviceConditionText(projected),/en un momento del evento/)
 assert.doesNotMatch(JSON.stringify(projected),/private|optionIds|operationalTimeline/)
})

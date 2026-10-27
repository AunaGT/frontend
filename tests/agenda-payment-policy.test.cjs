const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const load=()=>loadReportModule('../appointments/eventPaymentDraft.ts')
test('optional terms keep blanks, validate exact ranges and convert the reviewed local reference',()=>{
 const {eventPaymentDraft,eventPaymentDraftErrors,eventPaymentPayload}=load()
 const off=eventPaymentDraft(null,'America/Guatemala')
 assert.equal(eventPaymentPayload(off),null);assert.equal(off.depositPercent,'');assert.equal(off.balanceDaysBefore,'')
 const empty={...off,enabled:true};assert.ok(eventPaymentDraftErrors(empty).depositPercent);assert.throws(()=>eventPaymentPayload(empty))
 const good={...empty,depositPercent:'33.33',balanceDaysBefore:'0',referenceLocal:'2027-01-10T10:00'}
 assert.deepEqual(eventPaymentPayload(good),{schemaVersion:1,depositPercent:'33.33',balanceDaysBefore:0,referenceStartsAt:'2027-01-10T16:00:00.000Z',referenceTimezone:'America/Guatemala'})
 assert.ok(eventPaymentDraftErrors({...good,depositPercent:'100.01'}).depositPercent)
 assert.ok(eventPaymentDraftErrors({...good,balanceDaysBefore:'1.5'}).balanceDaysBefore)
 assert.equal(eventPaymentDraft({...eventPaymentPayload(good),basisTotal:'100.00',currencyCode:'GTQ'},'UTC').referenceLocal,'2027-01-10T10:00')
})
test('terms fields are opt-in, compact and labelled; zero is explicit, not a suggested agreement',()=>{
 const {EventPaymentTermsFields}=loadReportModule('../../components/shared/EventPaymentTermsFields.tsx')
 const value=load().eventPaymentDraft(null,'America/Guatemala')
 const html=renderToStaticMarkup(React.createElement(EventPaymentTermsFields,{value,total:'100.00',currencyCode:'GTQ',onChange(){},available:true}))
 assert.match(html,/Anticipo y saldo para servicios/);assert.doesNotMatch(html,/type="number"|type="datetime-local"/)
 const open=renderToStaticMarkup(React.createElement(EventPaymentTermsFields,{value:{...value,enabled:true},total:'100.00',currencyCode:'GTQ',onChange(){},available:true,errors:{depositPercent:'Indica el porcentaje acordado.'}}))
 assert.match(open,/max-w-/);assert.match(open,/aria-invalid="true"/);assert.match(open,/Indica el porcentaje acordado/);assert.doesNotMatch(open,/placeholder="50"/)
})
test('payment status gives one contextual next step and supports redacted staff views',()=>{
 const {EngagementPaymentStatus}=loadReportModule('../appointments/components/EngagementPaymentStatus.tsx')
 const state={enabled:true,confirmation:'PENDING_SCHEDULE',payment:'PARTIAL',dueAt:'2027-01-07T16:00:00Z',reference:{startsAt:'2027-01-10T16:00:00Z',timezone:'America/Guatemala'},canStart:false,canComplete:false,reasons:['SCHEDULE_INCOMPLETE']}
 const html=renderToStaticMarkup(React.createElement(EngagementPaymentStatus,{state,onCollect(){},onSchedule(){}}))
 assert.match(html,/Falta programar/);assert.match(html,/Programar servicios/);assert.doesNotMatch(html,/Registrar abono|undefined|NaN|GTQ|Q 0/)
 const review=renderToStaticMarkup(React.createElement(EngagementPaymentStatus,{state:{...state,confirmation:'REVIEW_REQUIRED'},onReview(){}}))
 assert.match(review,/Revisar contratación/);assert.doesNotMatch(review,/Marcar pagado/)
})
test('technical review fields are never printed as validation messages',()=>{
 const {FormFeedback}=loadReportModule('../appointments/components/FormFeedback.tsx')
 const html=renderToStaticMarkup(React.createElement(FormFeedback,{error:'Revisa el acuerdo',fields:{acknowledgedPaymentReviewHash:'a'.repeat(64),paymentReferenceReview:'PRIVATE_JSON',paymentPolicyCanOverride:'true',paymentPolicyReviewHash:'b'.repeat(64),paymentPolicyReasons:'["OVERDUE"]',reason:'Escribe un motivo'}}))
 assert.match(html,/Escribe un motivo/);assert.doesNotMatch(html,/PRIVATE_JSON|aaaaaaaa|bbbbbbbb|OVERDUE|>true</)
})
test('date review shows before and after without exposing hashes or consenting automatically',()=>{
 const {PaymentReferenceReview}=loadReportModule('../appointments/components/PaymentReferenceReview.tsx'),calls=[]
 const fields={acknowledgedPaymentReviewHash:'a'.repeat(64),paymentReferenceReview:JSON.stringify([{before:{startsAt:'2027-01-10T16:00:00Z',timezone:'America/Guatemala'},after:{startsAt:'2027-01-09T16:00:00Z',timezone:'America/Guatemala'},dueBefore:'2027-01-07T16:00:00Z',dueAfter:'2027-01-06T16:00:00Z'}])}
 const html=renderToStaticMarkup(React.createElement(PaymentReferenceReview,{fields,onConfirm:h=>calls.push(h)}))
 assert.match(html,/Vencimiento anterior/);assert.match(html,/Nuevo vencimiento/);assert.match(html,/Revisar cambio de fechas/);assert.doesNotMatch(html,/aaaaaaaa/);assert.equal(calls.length,0)
})
test('an operational exception needs its own motive and explicit confirmation; revoking access hides it',async()=>{
 const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[],hash='a'.repeat(64);let permitted=true
 const {AgendaActions}=loadReportModule('../appointments/components/AgendaActions.tsx',{react:h.hooks,'./api':{mutateAgenda:async(path,scope,body)=>{writes.push(body);throw Object.assign(Error('Saldo vencido'),{data:{fields:{paymentPolicyCanOverride:'true',paymentPolicyReviewHash:hash}}})}},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})}},nodes)
 const render=()=>{nodes.length=0;return h.render(()=>{const element=AgendaActions({scope:{companyId:'a',branchId:'b'},row:{id:'activity',version:1,status:'SCHEDULED',startsAt:'2020-01-01T00:00:00Z'},kind:'activities',has:()=>permitted});return element.type(element.props)})}
 render();nodes.find(n=>n.props.children==='Iniciar actividad').props.onClick();render()
 await nodes.find(n=>n.props.children==='Confirmar').props.onClick();render()
 assert.equal(writes.length,1);assert.equal(writes[0].exception,undefined)
 const review=()=>nodes.find(n=>n.props.children==='Revisar excepción para esta acción')
 assert.equal(review().props.disabled,true)
 nodes.find(n=>n.props.id==='agenda-payment-exception').props.onChange({target:{value:'Autorización documentada'}});render()
 review().props.onClick();render();assert.equal(writes.length,1)
 assert.equal(nodes.find(n=>n.props.title==='Autorizar solo esta acción').props.open,true)
 permitted=false;render();assert.equal(nodes.find(n=>n.props.title==='Autorizar solo esta acción').props.open,false);assert.equal(review(),undefined)
 permitted=true;render();nodes.find(n=>n.props.title==='Autorizar solo esta acción').props.onConfirm()
 await new Promise(resolve=>setImmediate(resolve))
 assert.deepEqual(writes[1].exception,{reason:'Autorización documentada',reviewHash:hash});assert.equal(writes[1].paid,undefined)
})

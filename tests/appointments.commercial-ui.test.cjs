const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const row={id:'e',branchId:'b',customer:{id:'c',name:'Cliente QA'},source:'QUOTE',quoteId:'q',orderId:null,saleId:null,version:1,resolutionPending:false,operationalState:'PARTIALLY_SCHEDULED',commercialReady:true,history:[],lines:[{id:'s',productId:'p',itemKind:'SERVICE',name:'Show de aniversario',unitLabel:'Evento',quantity:'2.0000',quantityDecimals:0,remainingQuantity:'1',currentConditions:{version:1,schedulingStyle:'WORK',durationPolicy:'EDITABLE',durationMinutes:60,allowedVenueKinds:['EVENT_VENUE'],publicInstructions:'Preparar escenario'},conditionsVersion:'a'.repeat(64),schedulingReady:true,schedules:[]},{id:'g',productId:'g',itemKind:'STANDARD',name:'Material de montaje',unitLabel:'Unidad',quantity:'1.0000',quantityDecimals:0,schedules:[]}],money:{currencyCode:'GTQ',agreedTotal:'175.00',total:'175.00',committed:'40.00',applied:'0.00',refunded:'0.00',remaining:'135.00'},paymentState:'PARTIAL',capabilities:{collect:true,resolve:true,issueSale:true,reason:''},receipts:[],refunds:[]}
test('optional shared schedule dates cannot block submitting a valid per-service schedule',()=>{
  const {EngagementProgramEditor}=loadReportModule('../appointments/pages/EngagementSchedulePage.tsx',{
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},timezone:'America/Guatemala',user:{id:'u'},hasPermission:()=>true,canUseContacts:false})},
    '../engagementDraft':{useEngagementDraft:()=>({programs:[{lineId:'s',quantity:'1',startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:'America/Guatemala',providerIds:[],resourceIds:[],venue:{kind:'EVENT_VENUE'},acknowledgedConditionsVersion:'a'.repeat(64)}],pending:false,fields:{},change(){},reviewVersion(){}})},
    '@tanstack/react-query':{useQuery:options=>({data:JSON.stringify(options.queryKey).includes('activity-users')?{items:[],total:0}:JSON.stringify(options.queryKey).includes('availability')?[]:{providerIds:[],resourceIds:[]}}),useQueryClient:()=>({invalidateQueries(){}})},
    '@/services/api':{getApiBaseUrl:()=>''},'./api':{getApiBaseUrl:()=>'',appointmentQueryKey:(...args)=>args},
  })
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(EngagementProgramEditor,{engagement:row,directory:{providers:[],resources:[],branches:[]},onSaved(){}})))
  const inputs=[...html.matchAll(/<input\b[^>]*>/g)].map(m=>m[0])
  const shared=inputs.filter(input=>input.includes('id="common-start"')||input.includes('aria-label="Inicio compartido hora"'))
  assert.equal(shared.length,2)
  assert.ok(shared.every(input=>!input.includes('required=""')),'unused common dates are optional even inside the collapsed section')
  assert.match(inputs.find(input=>input.includes('id="program-start"')),/required=""/,'the actual service start remains required')
})
test('native validation failures become visible scheduling feedback rather than a silent blocked submit',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[]
  const {EngagementProgramEditor}=loadReportModule('../appointments/pages/EngagementSchedulePage.tsx',{
    react:h.hooks,'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},timezone:'America/Guatemala',user:{id:'u'},hasPermission:()=>true})},
    '../components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},'./api':{getApiBaseUrl:()=>''},'@/services/api':{getApiBaseUrl:()=>''},
  },nodes)
  const render=()=>{nodes.length=0;h.render(()=>EngagementProgramEditor({engagement:row,directory:{providers:[],resources:[],branches:[]},onSaved(){}}))}
  render();const form=nodes.find(n=>n.type==='form')
  assert.equal(typeof form.props.onInvalidCapture,'function')
  let prevented=false
  form.props.onInvalidCapture({preventDefault(){prevented=true},target:{validationMessage:'La cantidad debe ser mayor que cero.'}})
  render();assert.equal(prevented,true)
  const feedback=nodes.find(n=>n.type.name==='FormFeedback')
  assert.match(feedback.props.error,/Revisa/)
  assert.equal(feedback.props.fields['line-s'],'La cantidad debe ser mayor que cero.')
})
test('review and schedule submits the configured service without using the optional shared date',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[],saved=[]
  const {EngagementProgramEditor}=loadReportModule('../appointments/pages/EngagementSchedulePage.tsx',{
    react:h.hooks,'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},timezone:'America/Guatemala',user:{id:'u'},hasPermission:()=>true})},
    '../components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},
    './api':{mutateAgenda:async(path,scope,body)=>{writes.push({path,body});return {...row,version:2}}},'@/services/api':{getApiBaseUrl:()=>''},
  },nodes)
  const render=()=>{nodes.length=0;h.render(()=>EngagementProgramEditor({engagement:row,directory:{providers:[],resources:[],branches:[]},onSaved:value=>saved.push(value)}))}
  render();let form=nodes.find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r))
  assert.equal(writes.length,0)
  render();assert.match(nodes.find(n=>n.type.name==='FormFeedback').props.fields['line-s'],/inicio y fin/)
  const fields=nodes.find(n=>n.type.name==='ProgramFields')
  fields.props.onChange({...fields.props.value,startsAt:'2030-01-01T15:00:00.000Z',endsAt:'2030-01-01T16:00:00.000Z'})
  render();form=nodes.find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r))
  assert.equal(writes.length,1);assert.equal(writes[0].path,'/engagements/e/program')
  assert.equal(writes[0].body.partial,false);assert.equal(writes[0].body.programs[0].startsAt,'2030-01-01T15:00:00.000Z')
  assert.equal(writes[0].body.programs[0].lineId,'s');assert.equal(saved[0].version,2)
})
test('engagement overview separates scheduling, paid balance and sale, and never gives physical goods a scheduling action',()=>{
  let components
  try{components=loadReportModule('../appointments/components/EngagementLines.tsx',{'@/services/api':{}})}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof components?.EngagementOverview,'function')
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(components.EngagementOverview,{engagement:row,hasPermission:()=>true})))
  assert.match(html,/Show de aniversario/);assert.match(html,/Material de montaje/)
  assert.match(html,/175\.00/);assert.match(html,/40\.00/);assert.match(html,/135\.00/)
  assert.match(html,/Programación parcial/);assert.match(html,/Venta pendiente/)
  assert.equal((html.match(/class="metric-strip-item"/g)||[]).length,5,'all metrics inherit the shared layout and responsive separators')
  assert.match(html,/no se programa|no van al calendario/)
  const privateRow={...row,money:undefined,paymentState:undefined,capabilities:undefined}
  const hidden=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(components.EngagementOverview,{engagement:privateRow,hasPermission:()=>false})))
  assert.doesNotMatch(hidden,/175\.00|135\.00|Registrar pago|Generar venta/)
})
test('reusable venue fields keep distinct accessible labels when editing common and per-service venues',()=>{
  const {AgendaVenueFields}=loadReportModule('../appointments/components/AgendaVenueFields.tsx')
  const render=prefix=>React.createElement(AgendaVenueFields,{idPrefix:prefix,value:{venue:{kind:'HOME'}},onChange(){}})
  const html=renderToStaticMarkup(React.createElement('div',null,render('common'),render('service')))
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1])
  assert.equal(new Set(ids).size,ids.length)
})
test('quote preparation never creates on mount and explicitly starts one engagement only after submitting',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[],saved=[]
  let preparation
  try{preparation=loadReportModule('../appointments/pages/EngagementSchedulePage.tsx',{
    react:h.hooks,'./api':{mutateAgenda:async(path,scope,body)=>{writes.push({path,scope,body});return row}},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},
    '@/services/api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},
  },nodes).QuotePreparation}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof preparation,'function')
  const quote={id:'q',status:'ACCEPTED',customer:'Cliente QA',total:'175.00',lines:[{id:'s',item_kind:'SERVICE',item_name:'Show',qty:'1',unit_label:'Evento'}],agenda:{canCreate:true,canOpen:false,reason:''}}
  h.render(()=>preparation({scope:{companyId:'a',branchId:'b'},quote,onSaved:value=>saved.push(value)}))
  assert.equal(writes.length,0)
  await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
  assert.equal(writes.length,1);assert.equal(writes[0].body.quoteId,'q');assert.equal(writes[0].path,'/engagements');assert.equal(saved[0].id,'e')
})
test('programming compares offered and current conditions beside an explicit acknowledgement',()=>{
  const {EngagementProgramEditor}=loadReportModule('../appointments/pages/EngagementSchedulePage.tsx',{
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},timezone:'America/Guatemala',user:{id:'u'},hasPermission:()=>true,canUseContacts:false})},
    '@tanstack/react-query':{useQuery:options=>({data:JSON.stringify(options.queryKey).includes('activity-users')?{items:[],total:0}:JSON.stringify(options.queryKey).includes('availability')?[]:{providerIds:[],resourceIds:[]}}),useQueryClient:()=>({invalidateQueries(){}})},
    '@/services/api':{apiFetch(){throw Error('Unexpected request')},getApiBaseUrl:()=>''},'./api':{getApiBaseUrl:()=>'',appointmentQueryKey:(...args)=>args},
  })
  const changed={...row,lines:[{...row.lines[0],conditionsChanged:true,offeredConditions:{...row.lines[0].currentConditions,durationMinutes:45,publicInstructions:'Condición ofrecida original'},currentConditions:{...row.lines[0].currentConditions,publicInstructions:'Condición actual revisada'}}]}
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(EngagementProgramEditor,{engagement:changed,directory:{providers:[],resources:[],branches:[]},onSaved(){}})))
  assert.match(html,/Condición ofrecida original/);assert.match(html,/Condición actual revisada/);assert.match(html,/Revisé las condiciones actuales/)
})
test('explicit context refresh retains programming dates while showing newly configured conditions',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[];let current=row
  const {EngagementProgramEditor}=loadReportModule('../appointments/pages/EngagementSchedulePage.tsx',{
    react:h.hooks,'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},timezone:'America/Guatemala',user:{id:'u'},hasPermission:()=>true})},
    '../components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},'./api':{getApiBaseUrl:()=>''},'@/services/api':{getApiBaseUrl:()=>''},
  },nodes)
  const render=()=>{nodes.length=0;h.render(()=>EngagementProgramEditor({engagement:current,directory:{providers:[],resources:[],branches:[]},onSaved(){},onRefresh:async()=>{current={...row,version:2,lines:[{...row.lines[0],conditionsVersion:'b'.repeat(64),conditionsChanged:true},row.lines[1]]};return current}}))}
  render();let fields=nodes.find(n=>n.type.name==='ProgramFields');fields.props.onChange({...fields.props.value,startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z'})
  render();const refresh=nodes.find(n=>n.props['aria-label']==='Actualizar contexto sin perder cambios');assert.ok(refresh)
  await refresh.props.onClick();render();fields=nodes.find(n=>n.type.name==='ProgramFields')
  assert.equal(fields.props.value.startsAt,'2030-01-01T15:00Z');assert.equal(fields.props.line.conditionsVersion,'b'.repeat(64))
})
test('refreshing operational requirements never silently acknowledges a newly changed conditions hash',()=>{
  const nodes=[]
  const changed={...row,lines:[{...row.lines[0],conditionsVersion:'b'.repeat(64),conditionsChanged:false}]}
  const {EngagementProgramEditor}=loadReportModule('../appointments/pages/EngagementSchedulePage.tsx',{
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},timezone:'America/Guatemala',user:{id:'u'},hasPermission:()=>true,canUseContacts:false})},
    '../engagementDraft':{useEngagementDraft:()=>({programs:[{lineId:'s',quantity:'1',startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:'America/Guatemala',providerIds:[],resourceIds:[],venue:{kind:'EVENT_VENUE'},acknowledgedConditionsVersion:'a'.repeat(64)}],pending:false,fields:{},change(){},reviewVersion(){}})},
    '@tanstack/react-query':{useQuery:options=>({data:JSON.stringify(options.queryKey).includes('activity-users')?{items:[],total:0}:JSON.stringify(options.queryKey).includes('availability')?[]:{providerIds:[],resourceIds:[]}}),useQueryClient:()=>({invalidateQueries(){}})},
    '@/services/api':{getApiBaseUrl:()=>''},'./api':{getApiBaseUrl:()=>'',appointmentQueryKey:(...args)=>args},
  },nodes)
  renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(EngagementProgramEditor,{engagement:changed,directory:{providers:[],resources:[],branches:[]},onSaved(){}})))
  const acknowledgement=nodes.find(n=>n.props['aria-label']==='Confirmar condiciones de Show de aniversario')
  assert.ok(acknowledgement);assert.equal(acknowledgement.props.checked,false)
})
test('the payment form posts a scoped receipt amount, not FIFO applications or an editable paid flag',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[],saved=[]
  let Form,ChannelFields
  try{const loaded=loadReportModule('../appointments/components/EngagementPaymentForm.tsx',{
    react:h.hooks,'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},ready:true,writable:true,hasPermission:()=>true})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
    '@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[{id:1,name:'Crédito',is_credit:true},{id:2,name:'Transferencia',is_credit:false}]})},
    '@tanstack/react-query':{useQuery:()=>({}),useQueryClient:()=>({invalidateQueries(){}})},
    './api':{mutateAgenda:async(path,scope,body)=>{writes.push({path,scope,body});return{receiptId:'r',engagement:row}}},
    '@/services/api':{getApiBaseUrl:()=>''},
  },nodes);Form=loaded.EngagementPaymentForm;ChannelFields=loaded.EngagementPaymentChannelFields}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof Form,'function')
  const render=()=>{nodes.length=0;h.render(()=>Form({engagement:row,onSaved:value=>saved.push(value),onCancel(){}}));ChannelFields(nodes.find(n=>n.type===ChannelFields).props)}
  render();nodes.find(n=>n.props.id==='engagement-payment-amount').props.onChange({target:{value:'40.00'}})
  nodes.find(n=>typeof n.props.onValueChange==='function'&&n.props.value==='').props.onValueChange('2')
  render();assert.ok(!nodes.some(n=>n.props.value==='1'&&n.props.children==='Crédito'))
  await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
  assert.equal(writes.length,1);assert.equal(writes[0].path,'/engagements/e/payments');assert.equal(writes[0].body.amount,'40.00');assert.equal(writes[0].body.paymentMethodId,2)
  assert.ok(!Object.hasOwn(writes[0].body,'applications'));assert.ok(!Object.hasOwn(writes[0].body,'paid'));assert.equal(saved[0].id,'e')
})
test('cash collection cannot submit without an open turn',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[]
  const {EngagementPaymentForm:Form,EngagementPaymentChannelFields:Channel}=loadReportModule('../appointments/components/EngagementPaymentForm.tsx',{
    react:h.hooks,'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},ready:true,writable:true})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
    '@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[{id:3,name:'Efectivo',is_credit:false}]})},
    '@tanstack/react-query':{useQuery:()=>({data:{ok:true,session:null,register:null}}),useQueryClient:()=>({invalidateQueries(){}})},
    './api':{mutateAgenda:async(...args)=>writes.push(args)},'@/services/api':{getApiBaseUrl:()=>''},
  },nodes)
  const render=()=>{nodes.length=0;h.render(()=>Form({engagement:row,onSaved(){},onCancel(){}}));Channel(nodes.find(n=>n.type===Channel).props)}
  render();nodes.find(n=>n.props.id==='engagement-payment-amount').props.onChange({target:{value:'40.00'}});nodes.find(n=>typeof n.props.onValueChange==='function').props.onValueChange('3');render()
  await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(writes.length,0)
})
test('collections display committed and refunded funds separately and hide money from operational readers',()=>{
  let Component
  try{Component=loadReportModule('../appointments/components/EngagementPayments.tsx',{
    '@/context/useTenant':{useTenant:()=>({company:{id:'a'},branch:{id:'b'}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'u'},permissionsReady:true,hasPermission:()=>false})},
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},writable:true,hasPermission:()=>true})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({companyName:'QA'})},'@/services/api':{getApiBaseUrl:()=>''},
  }).EngagementPayments}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof Component,'function')
  const paid={...row,receipts:[{id:'r',amount:'50.00',committed:'40.00',commitmentState:'COMMITTED',paidAt:'2030-01-01T12:00:00Z',method:'Transferencia',reference:'AB123',allocation:{received:'50.00',applied:'0.00',committed:'40.00',refunded:'10.00',available:'0.00'}}],refunds:[]}
  const render=value=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,{engagement:value,onSaved(){}})))
  const html=render(paid);assert.match(html,/AB123/);assert.match(html,/50\.00/);assert.match(html,/40\.00/);assert.match(html,/10\.00/);assert.match(html,/Descargar recibo/)
  assert.doesNotMatch(render({...paid,money:undefined,paymentState:undefined,capabilities:undefined,receipts:undefined}),/AB123|50\.00|Registrar abono/)
})
test('sale issuance uses server prices and existing receipts, with explicit goods dispatch',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[];let Component
  try{Component=loadReportModule('../appointments/components/EngagementDocuments.tsx',{
    react:h.hooks,'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},writable:true,hasPermission:()=>true})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},
    './api':{mutateAgenda:async(path,scope,body)=>{writes.push({path,body});return {...row,saleId:'sale'}}},'@/services/api':{getApiBaseUrl:()=>''},
  },nodes).EngagementSaleForm}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof Component,'function')
  const render=()=>{nodes.length=0;h.render(()=>Component({engagement:row,onSaved(){},onCancel(){}}))}
  render();await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(writes.length,0)
  nodes.find(n=>n.props['aria-label']==='Confirmar despacho de bienes').props.onCheckedChange(true)
  nodes.find(n=>typeof n.props.onValueChange==='function').props.onValueChange('CREDIT');render()
  await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
  const confirm=nodes.find(n=>n.props.title==='Confirmar venta vinculada');assert.ok(confirm);assert.equal(writes.length,0)
  await confirm.props.onConfirm();assert.equal(writes.length,1);assert.equal(writes[0].path,'/engagements/e/sale');assert.equal(writes[0].body.confirmGoodsDispatch,true);assert.equal(writes[0].body.paymentCondition,'CREDIT')
  assert.ok(!Object.hasOwn(writes[0].body,'payments'));assert.ok(!Object.hasOwn(writes[0].body,'total'));assert.ok(!Object.hasOwn(writes[0].body,'lines'))
})
test('refund confirmation identifies the exact pending refund and does not edit the original receipt',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[];let Form,Channel
  try{const loaded=loadReportModule('../appointments/components/EngagementPayments.tsx',{
    react:h.hooks,'../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},writable:true,hasPermission:()=>true})},
    './DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn(),request:fn=>fn()})},
    '@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[{id:2,name:'Transferencia',is_credit:false}]})},
    '@tanstack/react-query':{useQuery:()=>({}),useQueryClient:()=>({invalidateQueries(){}})},
    './api':{mutateAgenda:async(path,scope,body)=>{writes.push({path,body});return row}},'@/services/api':{getApiBaseUrl:()=>''},
  },nodes);Form=loaded.EngagementResolutionForm;Channel=loaded.EngagementPaymentChannelFields}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof Form,'function')
  const refund={id:'refund',receiptId:'r',amount:'10.00',status:'REQUESTED',reason:'Cancelación'}
  const render=()=>{nodes.length=0;h.render(()=>Form({engagement:{...row,refunds:[refund]},action:'CONFIRM_REFUND',refund,onSaved(){},onCancel(){}}));Channel(nodes.find(n=>n.type===Channel).props)}
  render();nodes.find(n=>n.props.id==='engagement-resolution-reason').props.onChange({target:{value:'Devolución bancaria confirmada'}});nodes.find(n=>typeof n.props.onValueChange==='function').props.onValueChange('2');render()
  await nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(writes.length,0)
  await nodes.find(n=>n.props.title==='Confirmar salida de dinero').props.onConfirm()
  assert.equal(writes.length,1);assert.equal(writes[0].path,'/engagements/e/resolution');assert.equal(writes[0].body.refundId,'refund');assert.equal(writes[0].body.receiptId,'r');assert.equal(writes[0].body.amount,'10.00');assert.equal(writes[0].body.action,'CONFIRM_REFUND')
})
test('engagement detail exposes one full-page programming destination and financial tabs only when authorized',()=>{
  let Page;const nodes=[];let current=row
  try{Page=loadReportModule('../appointments/pages/EngagementDetailPage.tsx',{
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'a',branchId:'b'},ready:true,writable:true,timezone:'America/Guatemala',hasPermission:()=>true})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({companyName:'QA'})},
    '@tanstack/react-query':{useQuery:()=>({data:current}),useQueryClient:()=>({invalidateQueries(){}})},
    '@/services/api':{getApiBaseUrl:()=>''},
  },nodes).default}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof Page,'function')
  const render=()=>renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/agenda/contrataciones/e']},React.createElement(Page)))
  const html=render();assert.match(html,/\/agenda\/contrataciones\/e\/programar/);assert.match(html,/Cobros/);assert.match(html,/Documentos/)
  current={...row,money:undefined,paymentState:undefined,capabilities:undefined};nodes.length=0
  const hidden=render();assert.doesNotMatch(hidden,/>Cobros<|175\.00|Registrar abono/)
})
test('programmed service links to the whole engagement instead of duplicating its total',()=>{
  let Component
  try{Component=loadReportModule('../appointments/components/EngagementOrigin.tsx').EngagementOrigin}catch(error){if(error.code!=='ENOENT')throw error}
  assert.equal(typeof Component,'function')
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,{engagementId:'e'})))
  assert.match(html,/\/agenda\/contrataciones\/e/);assert.match(html,/contratación completa/);assert.doesNotMatch(html,/175\.00/)
  assert.equal(renderToStaticMarkup(React.createElement(Component,{})),'')
})

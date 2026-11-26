const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const context={scope:{companyId:'a',branchId:'b'},ready:true,writable:true,hasPermission:()=>true,canUseCatalog:true,canUseContacts:true}
test('billing keeps its form while quantities recalculate, masks stale totals and blocks stale approval',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[]
  const preview={origin:{kind:'ACTIVITY',id:'event',version:1},engagementId:null,customer:{id:'client',name:'Cliente QA'},service:{id:'p',name:'Servicio por hora',unitLabel:'Hora',quantityDecimals:2},quantity:'1',unitPrice:'150',total:'150',currencyCode:'GTQ',priceSource:'CURRENT_CATALOG',reviewHash:'hash',canPrepare:true,schedule:{startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:'America/Guatemala'}}
  let result={data:preview,isFetching:false},options
  const {BillingWorkspace}=loadReportModule('../appointments/pages/ServiceBillingPreparationPage.tsx',{
    react:h.hooks,'react-router-dom':{...require('react-router-dom'),useNavigate:()=>()=>{}},
    '../useAgendaContext':{useAgendaContext:()=>context},'@/components/layout/PageNavigation':{usePageTrail(){}},
    '@tanstack/react-query':{useQuery:o=>{options=o;return result},useQueryClient:()=>({invalidateQueries(){}})},
    '../api':{appointmentQueryKey:(scope,kind,params)=>['appointments',scope.companyId,scope.branchId,kind,params]},
    './api':{mutateAgenda:async()=>writes.push('write')},
    '../components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn()})},
  },nodes)
  const render=()=>{nodes.length=0;return h.render(()=>BillingWorkspace({origin:{kind:'ACTIVITY',id:'event'}}))}
  const input=()=>nodes.find(n=>n.props.id==='agenda-quantity')
  const form=()=>nodes.find(n=>n.type==='form')
  try{
    render();const originalFormType=form().type
    input().props.onChange({target:{value:'1.25'}})
    render()
    assert.equal(nodes.find(n=>n.props.id==='billing-reviewed').props.disabled,true,'the debounce window cannot approve old prices')
    assert.equal(options.queryKey[4].quantity,'1','do not query each keystroke')
    result={data:undefined,isLoading:true,isFetching:true};render()
    assert.equal(form()?.type,originalFormType,'loading must not replace the form')
    assert.equal(input()?.props.value,'1.25')
    const previousQuery={queryKey:['appointments','a','b','billing-preview',{origin:{kind:'ACTIVITY',id:'event'},quantity:'1'}]}
    assert.equal(options.placeholderData(preview,previousQuery),preview)
    assert.equal(options.placeholderData(preview,{queryKey:['appointments','other','b','billing-preview',{}]}),undefined)
    assert.equal(options.placeholderData({...preview,origin:{...preview.origin,id:'other'}},previousQuery),undefined)
    result={data:preview,isPlaceholderData:true,isFetching:true};render()
    assert.equal(input().props.value,'1.25')
    const review=nodes.find(n=>n.props.id==='billing-reviewed')
    assert.equal(review.props.disabled,true)
    review.props.onCheckedChange(true)
    assert.equal(nodes.find(n=>n.props['aria-label']==='Total revisado').props.children,'—')
    form().props.onSubmit({preventDefault(){}})
    result={data:undefined,isError:true,error:Error('No se pudo revisar')};render()
    assert.equal(input().props.value,'1.25');assert.ok(form())
    assert.equal(nodes.find(n=>n.props.id==='billing-reviewed').props.checked,false)
    result={data:undefined,isLoading:true,isFetching:true};render()
    assert.equal(input().props.value,'1.25');assert.ok(form(),'retry must also retain the form')
    await new Promise(resolve=>setTimeout(resolve,320))
    result={data:{...preview,quantity:'1.25',total:'187.50',reviewHash:'new'},isFetching:false};render()
    assert.equal(options.queryKey[4].quantity,'1.25')
    assert.equal(nodes.find(n=>n.props.id==='billing-reviewed').props.checked,false)
    assert.equal(nodes.find(n=>n.props.id==='billing-reviewed').props.disabled,false)
    assert.deepEqual(writes,[])
  }finally{h.unmount()}
})
test('a dirty event draft can open a concurrently prepared engagement without an invisible navigation blocker',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],navigations=[],writes=[]
  const previousWindow=global.window
  global.window={history:{state:{idx:0}},addEventListener(){},removeEventListener(){}}
  const navigator={push:to=>navigations.push(to),replace:to=>navigations.push(to),go(){}}
  h.hooks.useContext=()=>({navigator})
  const navigate=(to,options)=>options?.replace?navigator.replace(to):navigator.push(to)
  function Navigate(props){h.hooks.useEffect(()=>navigate(props.to,{replace:props.replace}),[props.to]);return null}
  let p={origin:{kind:'ACTIVITY',id:'event',version:1},engagementId:null,customer:null,service:{id:'p',name:'Show',unitLabel:'Evento',quantityDecimals:2},quantity:'1',unitPrice:'500',total:'500',currencyCode:'GTQ',priceSource:'CURRENT_CATALOG',reviewHash:null,canPrepare:false,reason:'Selecciona cliente',schedule:{startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:'America/Guatemala'}}
  const {BillingWorkspace}=loadReportModule('../appointments/pages/ServiceBillingPreparationPage.tsx',{
    react:h.hooks,'react-router-dom':{...require('react-router-dom'),useNavigate:()=>navigate,Navigate},
    '../useAgendaContext':{useAgendaContext:()=>context},'@/components/layout/PageNavigation':{usePageTrail(){}},
    '@tanstack/react-query':{useQuery:()=>({data:p,isFetching:false}),useQueryClient:()=>({invalidateQueries(){}})},
    '../api':{appointmentQueryKey:(...args)=>args},'./api':{appointmentQueryKey:(...args)=>args,mutateAgenda:()=>writes.push('write')},
  },nodes)
  const render=()=>{nodes.length=0;return h.render(()=>{const element=BillingWorkspace({origin:{kind:'ACTIVITY',id:'event'}});return element.type===Navigate?Navigate(element.props):element})}
  try{
    render();nodes.find(n=>n.props.id==='agenda-quantity').props.onChange({target:{value:'0.5'}});render()
    p={...p,engagementId:'existing'};render()
    assert.deepEqual(navigations,['/agenda/contrataciones/existing'])
    assert.deepEqual(writes,[])
  }finally{h.unmount();global.window=previousWindow}
})
test('source billing action navigates without writing and hides for ineligible or unauthorized sources',()=>{
  const writes=[],{ServiceBillingAction}=loadReportModule('../appointments/components/ServiceBillingAction.tsx',{'../useAgendaContext':{useAgendaContext:()=>context},'../commercialApi':{prepareSourceBilling:()=>writes.push('write')}})
  const render=props=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(ServiceBillingAction,{origin:{kind:'BOOKING',id:'own-booking'},eligible:true,...props})))
  assert.match(render({}),/href="\/agenda\/reservas\/own-booking\/cobros"/)
  assert.match(render({engagementId:'existing'}),/href="\/agenda\/contrataciones\/existing"/)
  assert.equal(render({eligible:false}),'')
  context.writable=false;assert.equal(render({}),'');context.writable=true
  context.hasPermission=()=>false;assert.equal(render({}),'');context.hasPermission=()=>true
  assert.deepEqual(writes,[])
})
test('preparation page only reads on entry, shows immutable booking price and an unchecked duplicate-sale warning',()=>{
  const reads=[],writes=[],p={origin:{kind:'BOOKING',id:'b',version:1},engagementId:null,customer:{id:'c',name:'Cliente QA'},service:{id:'p',name:'Servicio QA',unitLabel:'Hora',quantityDecimals:2},quantity:'1.0000',unitPrice:'150.00',total:'150.00',currencyCode:'GTQ',priceSource:'RESERVATION',reviewHash:'h',canPrepare:true,reason:'',schedule:{startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',timezone:'America/Guatemala'}}
  const nodes=[],Page=loadReportModule('../appointments/pages/ServiceBillingPreparationPage.tsx',{
    '../useAgendaContext':{useAgendaContext:()=>context},'@/components/layout/PageNavigation':{usePageTrail(){}},
    '@tanstack/react-query':{useQuery:o=>{reads.push(o);return {data:p,isFetching:false,refetch:async()=>({data:p})}},useQueryClient:()=>({invalidateQueries(){}})},
    '../api':{appointmentQueryKey:(...args)=>args,mutateAgenda:()=>writes.push('write')},
    './api':{appointmentQueryKey:(...args)=>args,mutateAgenda:()=>writes.push('write')},
    '../components/DraftGuard':{useDraftGuard:()=>({dialog:null,proceed:fn=>fn()})},
  },nodes).default
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page,{kind:'BOOKING'})))
  assert.ok(reads.length);assert.deepEqual(writes,[]);assert.match(html,/Cliente QA/);assert.match(html,/Precio original de la reserva/)
  assert.match(html,/Preparar crea un borrador de venta, sin registrar cobros ni efectos contables/);assert.match(html,/Si ya registraste esta prestación en Ventas/)
  assert.equal(nodes.filter(n=>n.props.id==='billing-reviewed')[0].props.checked,false)
  assert.doesNotMatch(html,/type="datetime-local"/)
})
test('participant billing targets the individual booking, never its shared session',()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[]
  const {SessionParticipants}=loadReportModule('../appointments/components/SessionParticipants.tsx',{react:h.hooks,'../api':{appointmentQueryKey:()=>[]},'./api':{appointmentQueryKey:()=>[]},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})}},nodes)
  const row={id:'own-booking',status:'CONFIRMED',contactName:'Cliente',commercial:null}
  h.render(()=>SessionParticipants({scope:{companyId:'a',branchId:'b'},session:{id:'shared-session',status:'SCHEDULED',startsAt:'2030-01-01T15:00Z',bookings:{items:[row],totalItems:1},waitlist:{items:[],totalItems:0}},has:()=>true,writable:true,page:1,waitPage:1,onPage(){},onWaitPage(){},search:'',onSearch(){}}))
  const action=nodes.find(n=>n.type?.name==='ServiceBillingAction')
  assert.deepEqual(action?.props.origin,{kind:'BOOKING',id:'own-booking'})
})

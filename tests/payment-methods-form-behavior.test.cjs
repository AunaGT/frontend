const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('saving closure transports unidentified money separately from the user difference reason',async()=>{
  let sent
  const previousFetch=global.fetch
  global.fetch=async(_url,request)=>{sent=JSON.parse(request.body);return{ok:true,json:async()=>({closure_number:7})}}
  try{
    const hook=loadReportModule('../cash-closure/hooks/useCashClosureAPI.ts',{
      react:{...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useCallback:fn=>fn,useEffect(){}},
      '@/hooks/use-toast':{useToast:()=>({toast(){}})},
      '@/hooks/usePersistedListUiState':{readListUiPersisted:()=>({}),writeListUiPersisted(){}},
      '@/hooks/useSystemSettings':{useSystemSettings:()=>({timezone:'America/Guatemala'})},
      '@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>null},
    }).useCashClosureAPI
    const saved=await hook().saveClosure({startDate:'2026-10-15',endDate:'2026-10-16',cashierName:'QA',theoreticalData:{theoretical:{net_total:25,total_sales:0,total_returns:0},metrics:{total_transactions:0,total_customers:0,average_ticket:0},unidentified_collections_amount:25},actualTotal:0,notes:'  Recuento revisado  ',paymentBreakdown:[],denominations:[]})
    assert.equal(saved,true);assert.equal(sent.unidentifiedCollectionsAmount,25)
    assert.equal(sent.notes,'Recuento revisado');assert.deepEqual(sent.paymentBreakdowns,[])
  }finally{global.fetch=previousFetch}
})
test('legacy unidentified collections are visible read-only instead of presented as cash',()=>{
  const Summary=loadReportModule('../cash-closure/components/TheoreticalSummary.tsx',{
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ',locale:'es-GT'})},
  }).TheoreticalSummary
  const html=renderToStaticMarkup(React.createElement(Summary,{data:{theoretical:{total_sales:0,total_returns:0,total_collections:25,net_total:25},metrics:{},unidentified_collections_amount:25}}))
  assert.match(html,/Medio no registrado/);assert.match(html,/25\.00/);assert.match(html,/incluido en el total esperado/)
  assert.doesNotMatch(html,/<input/)
})
for(const [kind,name,want] of [['CASH','Mostrador',true],['BANK','Efectivo digital',false],[null,'Cash',true],[null,'Cash anterior',false]])
test(`Agenda cash session requirement honors ${kind} ${name}`,()=>{
  const hook=loadReportModule('../appointments/components/EngagementPaymentForm.tsx',{
    react:{...React,useState:()=>['11',()=>{}]},
    '@/hooks/usePaymentMethods':{usePaymentMethods:()=>({data:[{id:11,name,settlement_kind:kind,is_credit:false}]})},
    '../useAgendaContext':{useAgendaContext:()=>({scope:{companyId:'A',branchId:'B'},writable:true})},
    '@tanstack/react-query':{useQuery:q=>({enabled:q.enabled})},
    '@/services/api':{getApiBaseUrl:()=>'/api'},'./api':{getApiBaseUrl:()=>'/api'},
  }).useEngagementPaymentChannel
  const channel=hook(true);assert.equal(channel.cash,want);assert.equal(channel.session.enabled,want)
})
test('cash closure instructions use typed breakdown rather than its label',()=>{
  const Component=loadReportModule('../cash-closure/components/PaymentMethodsForm.tsx',{
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ',locale:'es-GT'})},
  }).PaymentMethodsForm
  const base={payment_method_id:11,payment_method_name:'Mostrador',settlement_kind:'CASH',theoretical_amount:20,theoretical_count:1,actual_amount:0,actual_count:0,difference:0,notes:null}
  const props={paymentBreakdown:[base],cashSession:{opening_float:10,cash_sales_amount:10,expected_cash_in_drawer:20},onUpdateAmount(){}}
  assert.match(renderToStaticMarkup(React.createElement(Component,props)),/Cuente todo el efectivo/)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Component,{...props,paymentBreakdown:[{...base,payment_method_name:'Efectivo digital',settlement_kind:'BANK'}]})),/Cuente todo el efectivo/)
})

const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
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

const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const doc=(extra={})=>({id:'case',version:4,status:'LOST',claimed:'100.00',withdrawn:'100.00',recovered:'0.00',fees:'0.00',charged:'60.00',customerCredit:'0.00',disposed:'60.00',unresolved:'40.00',currencyCode:'GTQ',customerName:'Comercial El Sol',
  lots:[{id:'lot-absorbed',kind:'ABSORBED',remaining:'40.00',outstanding:null,chargeReference:null},{id:'lot-charge',kind:'CUSTOMER_CHARGE',remaining:'60.00',outstanding:'35.00',chargeReference:'CC-PRIN-000001'}],
  legacyDeductions:[],can:{manage:true,movements:true,resolve:true,charge:true,adjust:true,post:true},...extra})
const money=v=>`Q${v}`
const render=(el)=>renderToStaticMarkup(el)

test('a disposition splits the unresolved loss between the customer and the company and payloads keep exact decimals',()=>{
  const {ResolutionFields,resolutionPayload}=loadReportModule('../cash-closure/components/CashDisputeResolutionFields.tsx',{'@/services/api':{}})
  const html=render(React.createElement(ResolutionFields,{kind:'DISPOSITION',doc:doc(),value:{customerPrincipal:'',absorbedPrincipal:'',dueOn:'',lotId:'',amount:''},onChange(){},disabled:false,money}))
  for(const label of ['Cobrar al cliente','Asume la empresa','Vencimiento del cargo','Q40.00'])assert.ok(html.includes(label),label)
  assert.deepEqual(resolutionPayload('DISPOSITION',{customerPrincipal:'25',absorbedPrincipal:'15.5',dueOn:'',lotId:'x',amount:'1'},' Acuerdo '),{reason:'Acuerdo',customerPrincipal:'25.00',absorbedPrincipal:'15.50'})
  assert.deepEqual(resolutionPayload('DISPOSITION',{customerPrincipal:'40',absorbedPrincipal:'',dueOn:'2026-12-31',lotId:'',amount:''},'Acuerdo'),{reason:'Acuerdo',customerPrincipal:'40.00',absorbedPrincipal:'0.00',dueOn:'2026-12-31'})
  assert.equal(resolutionPayload('DISPOSITION',{customerPrincipal:'1.234',absorbedPrincipal:'',dueOn:'',lotId:'',amount:''},'x'),null,'more than two decimals is rejected before any request')
  const anonymous=render(React.createElement(ResolutionFields,{kind:'DISPOSITION',doc:doc({customerName:null}),value:{customerPrincipal:'',absorbedPrincipal:'',dueOn:'',lotId:'',amount:''},onChange(){},disabled:false,money}))
  assert.match(anonymous,/sin cliente identificado/i)
})
test('forgiving lists only customer charges with what is still owed; correcting lists every live resolution',()=>{
  const {ResolutionFields,resolutionPayload}=loadReportModule('../cash-closure/components/CashDisputeResolutionFields.tsx',{'@/services/api':{}})
  const value={customerPrincipal:'',absorbedPrincipal:'',dueOn:'',lotId:'lot-charge',amount:''}
  const forgive=render(React.createElement(ResolutionFields,{kind:'FORGIVE',doc:doc(),value,onChange(){},disabled:false,money}))
  assert.ok(forgive.includes('CC-PRIN-000001'));assert.ok(forgive.includes('Q35.00'),'the limit is the unpaid part, not the original charge')
  assert.equal(forgive.includes('Pérdida asumida'),false)
  const correct=render(React.createElement(ResolutionFields,{kind:'CORRECT',doc:doc(),value,onChange(){},disabled:false,money}))
  assert.ok(correct.includes('Pérdida asumida por la empresa'));assert.ok(correct.includes('Cargo al cliente'))
  assert.deepEqual(resolutionPayload('FORGIVE',{...value,amount:'10'},'Cortesía'),{reason:'Cortesía',lotId:'lot-charge',amount:'10.00'})
  assert.equal(resolutionPayload('CORRECT',{...value,lotId:''},'x'),null,'a correction needs its resolution')
})
test('the movement form offers a bank recovery only while withdrawn money is still unrecovered',()=>{
  const {CashDisputeMovementForm}=loadReportModule('../cash-closure/components/CashDisputeMovementForm.tsx')
  const props=d=>({doc:{...doc(),originMode:'DIRECT',providerPending:null,...d},locale:'es-GT',today:'2026-11-25',onConfirm:async()=>{},onRefresh(){}})
  const nodes=[],{CashDisputeMovementForm:Form}=loadReportModule('../cash-closure/components/CashDisputeMovementForm.tsx',{},nodes)
  assert.ok(render(React.createElement(CashDisputeMovementForm,props({}))).includes('El banco devolvió el dinero'))
  render(React.createElement(Form,props({recovered:'100.00'})))
  const recovery=nodes.find(n=>n.props?.['aria-pressed']!==undefined&&n.props.id==='dispute-movement-recovery')
  assert.ok(recovery);assert.equal(recovery.props.disabled,true,'nothing left to recover')
})
test('a historical deduction is linked for its exact amount with no editable principal',()=>{
  const nodes=[],{CashDisputeLegacyForm}=loadReportModule('../cash-closure/components/CashDisputeLegacyForm.tsx',{},nodes)
  const d=doc({legacyDeductions:[{id:'ded-1',amount:'20.00',settlementId:'s-1',depositedOn:'2026-11-23',reference:'DEP-77'}]})
  const html=render(React.createElement(CashDisputeLegacyForm,{doc:d,locale:'es-GT',onConfirm:async()=>{},onRefresh(){}}))
  for(const label of ['DEP-77','20.00','Referencia'])assert.ok(html.includes(label),label)
  assert.equal(nodes.some(n=>n.props?.id==='dispute-legacy-principal'),false,'the amount is the deduction itself')
  const closed=[],{CashDisputeLegacyForm:Closed}=loadReportModule('../cash-closure/components/CashDisputeLegacyForm.tsx',{},closed)
  render(React.createElement(Closed,{doc:{...d,can:{...d.can,movements:false}},locale:'es-GT',onConfirm:async()=>assert.fail('closed'),onRefresh(){}}))
  for(const n of closed.filter(n=>typeof n.props?.id==='string'&&n.props.id.startsWith('dispute-legacy-')))assert.equal(n.props.disabled,true)
})
test('late posting is offered only to accounting authority when deferred sources exist',()=>{
  const {MemoryRouter}=require('react-router-dom')
  const {CashDisputeAccounting}=loadReportModule('../cash-closure/components/CashDisputeAccounting.tsx',{'@/services/api':{}})
  const accounting={enabled:true,status:'DEFERRED',issues:[],sources:[{id:'e1',kind:'BANK_DEBIT',status:'DEFERRED',economicOn:'2026-11-23',accountingOn:null,entryId:null,entryNumber:null}]}
  const html=p=>render(React.createElement(MemoryRouter,null,React.createElement(CashDisputeAccounting,{accounting,locale:'es-GT',...p})))
  assert.ok(html({onPost(){}}).includes('Contabilizar pendientes'))
  assert.equal(html({}).includes('Contabilizar pendientes'),false)
  assert.equal(render(React.createElement(MemoryRouter,null,React.createElement(CashDisputeAccounting,{accounting:{...accounting,sources:[{...accounting.sources[0],status:'POSTED'}]},onPost(){}}))).includes('Contabilizar pendientes'),false)
})
test('a settlement chargeback names its case and a recovery raises the expected net',()=>{
  const {settlementBalance}=loadReportModule('../cash-closure/components/settlementParts.ts')
  assert.deepEqual(settlementBalance({allocations:[{direction:'IN',amount:'100.00'}],deductions:[{amount:'20.00'}],recoveries:[{amount:'15.00'}],net:'95.00'}),{gross:'100.00',refunds:'0.00',deductions:'20.00',recoveries:'15.00',expected:'95.00',difference:'0.00',balanced:true})
  const {SettlementRecoveries}=loadReportModule('../cash-closure/components/SettlementDisputeFields.tsx',{'@/services/api':{}})
  const cases=[{id:'d1',event_id:'e1',provider_reference:'VISA-CB-1',claimed:'100.00',status:'WON'}]
  const html=render(React.createElement(SettlementRecoveries,{cases,value:[{disputeId:'d1',amount:'15.00'}],onChange(){},disabled:false}))
  for(const label of ['Recuperaciones de disputas','VISA-CB-1'])assert.ok(html.includes(label),label)
})

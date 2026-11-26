const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('accounting sources explain integrated versus reclassified deductions and gate the original settlement link',()=>{
  const {MemoryRouter}=require('react-router-dom')
  const {CashDisputeAccounting}=loadReportModule('../cash-closure/components/CashDisputeAccounting.tsx',{'@/services/api':{}})
  const accounting={enabled:true,status:'READY',issues:[],sources:[{id:'integrated',kind:'LEGACY_WITHHOLDING',status:'INTEGRATED',economicOn:'2026-11-23',accountingOn:'2026-11-23',entryNumber:'ASI-001',settlementId:'s-1',settlementReference:'DEP-001',accountingRoute:'SETTLEMENT'},
    {id:'reclass',kind:'LEGACY_WITHHOLDING',status:'POSTED',economicOn:'2026-10-23',accountingOn:'2026-11-23',entryNumber:'ASI-002',settlementId:'s-2',settlementReference:'DEP-002',accountingRoute:'RECLASSIFICATION',dateChangeReason:'Período original cerrado'}]}
  const render=canViewSettlement=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(CashDisputeAccounting,{accounting,locale:'es-GT',canViewSettlement})))
  const html=render(true)
  for(const label of ['Incluido en la liquidación','Reclasificación contable','DEP-001','ASI-002','Período original cerrado'])assert.ok(html.includes(label),label)
  assert.match(html,/href="\/cierre-caja\/liquidaciones\/s-1"/)
  assert.doesNotMatch(render(false),/href="\/cierre-caja\/liquidaciones/)
  assert.doesNotMatch(html,/type="submit"|<input|Reintentar/)
})
test('dispute summary separates the claim, bank money and customer debt with no editable balance fields',()=>{
  const {CashDisputeSummary}=loadReportModule('../cash-closure/components/CashDisputeSummary.tsx')
  const html=renderToStaticMarkup(React.createElement(CashDisputeSummary,{doc:{claimed:'100.00',withdrawn:'100.00',recovered:'0.00',charged:'60.00',customerCredit:'0.00',disposed:'100.00',unresolved:'0.00',currencyCode:'GTQ'},locale:'es-GT'}))
  for(const label of ['Reclamado','Retirado o retenido','Recuperado','Cargo al cliente','100.00','60.00'])assert.ok(html.includes(label),label)
  assert.equal(html.includes('<input'),false)
})
test('new accounting sources are readable and cannot be reversed through the generic journal action',()=>{
  const {SOURCE_LABELS,canReverseJournalEntry}=loadReportModule('../accounting/components/format.ts')
  for(const source of ['CASH_DISPUTE_EFFECT','CASH_DISPUTE_DISPOSITION','CASH_DISPUTE_ADJUSTMENT']){
    assert.ok(SOURCE_LABELS[source]);assert.equal(canReverseJournalEntry({source_type:source,reversals:[]}),false)
  }
})
test('an unavailable movement form explains the two funding routes and prevents financial submission',()=>{
  const nodes=[],{CashDisputeMovementForm}=loadReportModule('../cash-closure/components/CashDisputeMovementForm.tsx',{},nodes)
  const html=renderToStaticMarkup(React.createElement(CashDisputeMovementForm,{doc:{id:'case',version:2,claimed:'100',withdrawn:'0',recovered:'0',fees:'0',charged:'0',customerCredit:'0',disposed:'0',unresolved:'0',currencyCode:'GTQ',originMode:'DEFERRED',providerPending:'100',can:{movements:false}},locale:'es-GT',today:'2026-11-24',onConfirm:async()=>assert.fail('Cannot submit a closed command'),onRefresh:()=>{}}))
  for(const label of ['Se debitó del banco','El proveedor lo retuvo','Principal','Comisión','Referencia','Fecha del movimiento','solo consulta'])assert.ok(html.includes(label),label)
  const inputs=nodes.filter(n=>typeof n.props?.id==='string'&&n.props.id.startsWith('dispute-movement-'))
  assert.ok(inputs.length>=4);for(const n of inputs)assert.equal(n.props.disabled,true)
})

const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const lines=[{closurePaymentId:1,name:'Efectivo',kind:'CASH',originalExpected:'1000.00',previousActual:'900.00',correctedActual:'980.00',delta:'80.00',correctedDifference:'-20.00'}]
test('correction comparison keeps original, previous and corrected amounts separately with readable labels',()=>{
  const {CorrectionLines}=loadReportModule('../cash-closure/components/CashCorrectionSummary.tsx')
  const html=renderToStaticMarkup(React.createElement(CorrectionLines,{lines,currency:'GTQ',locale:'es-GT'}))
  for(const s of ['Esperado original','Declarado anterior','Correcto','Cambio','1,000.00','900.00','980.00','80.00'])assert.ok(html.includes(s),s)
  assert.equal(html.includes('<input'),false)
})
test('correction amount editing is compact and labels each original payment instead of adding full width fields',()=>{
  const nodes=[],{CorrectionLines}=loadReportModule('../cash-closure/components/CashCorrectionSummary.tsx',{},nodes)
  renderToStaticMarkup(React.createElement(CorrectionLines,{lines,currency:'GTQ',locale:'es-GT',values:{1:'980'},onChange(){}}))
  const input=nodes.find(n=>n.props?.id==='correction-amount-1')
  assert.ok(input);assert.equal(input.props.inputMode,'decimal');assert.ok(input.props['aria-label'].includes('Efectivo'))
})
test('accounting labels correction sources and never offers generic reversal for a correction entry',()=>{
  const {SOURCE_LABELS,canReverseJournalEntry}=loadReportModule('../accounting/components/format.ts')
  assert.equal(SOURCE_LABELS.CASH_CLOSURE_CORRECTION,'Corrección de arqueo')
  assert.equal(canReverseJournalEntry({source_type:'CASH_CLOSURE_CORRECTION'}),false)
  assert.equal(canReverseJournalEntry({source_type:'MANUAL',reversals:[]}),true)
})
test('consolidated correction identity allows reading but keeps creation unavailable',()=>{
  const mocks={'@/context/useTenant':{useTenant:()=>({company:{id:'c'},branch:null,isConsolidated:true})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'u'},hasPermission:()=>true})}}
  const {useCorrectionIdentity}=loadReportModule('../cash-closure/hooks/useCorrectionIdentity.ts',mocks)
  const states=[]
  function Probe(){states.push([useCorrectionIdentity().ready,useCorrectionIdentity(true).ready]);return null}
  renderToStaticMarkup(React.createElement(Probe));assert.deepEqual(states,[[false,true]])
})

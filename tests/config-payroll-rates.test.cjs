const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{deferred,flush}=require('./helpers/configHarness.cjs')
const rates={igssLaboral:.0483,igssPatronal:.1067,irtra:.01,intecap:.01,bonificacionIncentivo:250,isrDeduccionUnica:48000,isrTramo1Limite:300000,isrTramo1Tasa:.05,isrTramo2Fijo:15000,isrTramo2Tasa:.07,horaExtraFactor:1.5,provisionAguinaldo:.0833,provisionBono14:.0833,provisionVacaciones:.0417,provisionIndemnizacion:.0972}
test('payroll percentages round-trip precisely; blank or out-of-range fields cannot publish',()=>{
  const m=loadReportModule('../config/payrollRateModel.ts'),draft=m.ratesToDraft(rates)
  assert.equal(draft.igssLaboral,'4.83');assert.equal(draft.bonificacionIncentivo,'250')
  assert.deepEqual(m.ratesPayload(draft),rates)
  assert.equal(m.validateRatesDraft({...draft,igssLaboral:'101'}).igssLaboral.length>0,true)
  assert.equal(m.validateRatesDraft({...draft,isrDeduccionUnica:''}).isrDeduccionUnica.length>0,true)
  assert.equal(m.validateRatesDraft({...draft,horaExtraFactor:'0'}).horaExtraFactor.length>0,true)
  assert.equal(m.canAdoptRunRates({status:'PAGADA'},true),false)
  assert.equal(m.canAdoptRunRates({status:'BORRADOR'},false),false)
  assert.equal(m.canAdoptRunRates({status:'BORRADOR'},true),true)
  assert.match(m.runRateSource({rates_snapshot:null}),/histórica|copia/i)
  assert.doesNotMatch(m.runRateSource({rates_snapshot:null}),/vigentes/)
})
test('publication preserves failed draft and stale A→B→A replies cannot replace the new generation',async()=>{
  const h=hookHarness(),late=deferred(),calls=[]
  let context={userId:'U',companyId:'A',branchId:'BA',canRead:true,canPublish:true},count=0,last
  const service={getRateVersions:async()=>{count++;return count===2?late.promise:{items:[],current:{rates,versionId:null,source:'legacy'},today:'2026-10-16'}},publishRateVersion:async(payload,scope)=>{calls.push([payload,scope]);throw Error('Conflicto')},cancelRateVersion:async()=>{}}
  const hook=loadReportModule('../config/usePayrollRateDraft.ts',{react:h.hooks,'@/modules/payroll/api/rateVersions':service,'@/services/api':{getActiveCompanyId:()=>context.companyId,getActiveBranchId:()=>context.branchId}}).usePayrollRateDraft
  const render=()=>last=h.render(()=>hook(context,()=>true))
  try{
    render();await flush();render();last.setField('igssLaboral','6');last.setMeta('effectiveFrom','2026-11-01');last.setMeta('reason','Ajuste');render()
    await last.publish();render();assert.equal(last.draft.igssLaboral,'6');assert.match(last.error,/Conflicto/);assert.equal(calls[0][0].rates.igssLaboral,.06);assert.equal(calls[0][1].companyId,'A')
    context={...context,companyId:'B',branchId:'BB'};render();context={...context,companyId:'A',branchId:'BA'};render();await flush();render();late.resolve({items:[],current:{rates:{...rates,igssLaboral:.9},versionId:null,source:'legacy'},today:'2026-10-16'});await flush();render()
    assert.equal(last.draft.igssLaboral,'4.83')
  }finally{h.unmount()}
})
test('run parameters panel never presents current rates as historical and paid runs have no adoption action',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const Panel=loadReportModule('../payroll/pages/RunRatesPanel.tsx',{'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B'},'../api/rateVersions':{}}).RunRatesPanel
  const html=renderToStaticMarkup(React.createElement(Panel,{run:{id:'R',status:'PAGADA',rates_snapshot:null},scope:{companyId:'A',branchId:'B'},canAdopt:true,onUpdated(){}}))
  assert.match(html,/histórica sin copia/);assert.doesNotMatch(html,/Revisar parámetros disponibles|Confirmar actualización/)
})
test('a blank new employee bonus stays omitted so the company policy applies, not zero or a fixed default',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),nodes=[],changes=[]
  const Form=loadReportModule('../hr/pages/EmployeeForm.tsx',{'@/services/hrService':{PAYMENT_METHOD_LABELS:{}},'./EmployeeSupervisorSelect':{EmployeeSupervisorSelect:()=>null}},nodes).EmployeeForm
  renderToStaticMarkup(React.createElement(Form,{value:{first_name:'A',last_name:'B',base_salary:1000,hire_date:'2026-10-16'},onChange:v=>changes.push(v),disabled:false}))
  nodes.find(n=>n.props.id==='hr-bonificacion_incentivo'&&n.props.onChange).props.onChange({target:{value:''}})
  assert.equal(changes[0].bonificacion_incentivo,undefined)
})
test('a committed cancellation with failed refresh is distinguished from failure to cancel',async()=>{
  const h=hookHarness();let calls=0,last
  const context={userId:'U',companyId:'A',branchId:'B',canRead:true,canPublish:true}
  const hook=loadReportModule('../config/usePayrollRateDraft.ts',{react:h.hooks,'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B'},'@/modules/payroll/api/rateVersions':{
    getRateVersions:async()=>{if(++calls>1)throw Error('Sin conexión');return{items:[],current:{rates,versionId:null,source:'legacy'},today:'2026-10-16'}},cancelRateVersion:async()=>({})}}).usePayrollRateDraft
  const render=()=>last=h.render(()=>hook(context,()=>true))
  try{render();await flush();render();await last.cancel('V','Corregir');render();assert.match(last.error,/Versión cancelada/)}finally{h.unmount()}
})

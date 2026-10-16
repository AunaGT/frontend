const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderConfig}=require('./helpers/configViewHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {configHarness,flush,deferred}=require('./helpers/configHarness.cjs')
const policy={windowDays:60,allowAuthorizedExceptions:false,exchangePricing:'ORIGINAL_SALE_PRICE',enabledResolutions:['CUSTOMER_CREDIT']}
const model=()=>loadReportModule('../config/settingsModel.ts')
const input=(view,id)=>view.nodes.find(n=>n.props.id===id && typeof n.props.onChange==='function')
const checked=(view,id)=>view.nodes.find(n=>n.props.id===id && typeof n.props.onCheckedChange==='function')
test('return policy section displays the effective company values and the confirmed request-date rule',()=>{
  const view=renderConfig({section:'devoluciones',values:{'returns.policy':policy}})
  assert.equal(input(view,'returns.policy.windowDays')?.props.value,'60')
  assert.equal(checked(view,'returns.policy.allowAuthorizedExceptions')?.props.checked,false)
  assert.equal(checked(view,'returns.policy.resolution.CUSTOMER_CREDIT')?.props.checked,true)
  assert.equal(checked(view,'returns.policy.resolution.REFUND_CASH')?.props.checked,false)
  assert.match(view.html,/fecha de solicitud/i);assert.match(view.html,/24 horas/);assert.match(view.html,/no.*recalcul/i)
  assert.match(view.html,/permiso para autorizar devoluciones fuera de plazo/);assert.match(view.html,/justificación/);assert.doesNotMatch(view.html,/id="company_nit"|id="cash_closure_max_diff_pct"/)
  assert.equal(model().findSettingsSections('excepciones')[0].id,'devoluciones')
})
test('policy controls produce one whole JSON draft without mutating the confirmed policy',async()=>{
  const source=structuredClone(policy),view=renderConfig({section:'devoluciones',values:{'returns.policy':source}})
  input(view,'returns.policy.windowDays').props.onChange({target:{value:'45'}})
  assert.deepEqual(view.changes.at(-1),{id:'devoluciones',field:'returns.policy',value:{...policy,windowDays:'45'}})
  assert.deepEqual(source,policy)
  await view.nodes.find(n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Guardar cambios')).props.onClick()
  assert.deepEqual(view.writes,[{'returns.policy':{...policy,windowDays:45}}])
})
test('policy validation rejects unsafe coercions, unknown choices and an empty resolution list',()=>{
  const m=model()
  for(const [field,values] of [['windowDays',[0,-1,1.2,true,[],{},'',Infinity,Number.MAX_SAFE_INTEGER+1]],['allowAuthorizedExceptions',['false',null,0]],['exchangePricing',['',null,'UNKNOWN',['CURRENT_PRICE']]],['enabledResolutions',[[],['UNKNOWN'],['REFUND_CASH','UNKNOWN'],null,'REFUND_CASH']]]) {
    for(const value of values) assert.ok(m.validateSection('devoluciones',{'returns.policy':{...policy,[field]:value}})[`returns.policy.${field}`],field+':'+JSON.stringify(value))
  }
  assert.deepEqual(m.validateSection('devoluciones',{'returns.policy':policy}),{})
})
test('policy projection defaults only missing data and semantic comparison ignores list order and numeric spelling',()=>{
  const m=model(),effective=m.sectionValues('devoluciones',{})['returns.policy']
  assert.equal(effective.windowDays,30);assert.equal(effective.allowAuthorizedExceptions,true);assert.equal(effective.enabledResolutions.length,5)
  assert.equal(m.sectionValues('devoluciones',{'returns.policy':null})['returns.policy'],null)
  const a={'returns.policy':{...policy,windowDays:'060',enabledResolutions:['EXCHANGE','REFUND_CASH']}},b={'returns.policy':{...policy,enabledResolutions:['REFUND_CASH','EXCHANGE','EXCHANGE']}}
  assert.equal(m.sameSection('devoluciones',a,b),true)
  assert.equal(m.sameSection('devoluciones',a,{'returns.policy':policy}),false)
  assert.equal(m.sameSection('devoluciones',{'returns.policy':policy},{'returns.policy':{enabledResolutions:['CUSTOMER_CREDIT'],exchangePricing:'ORIGINAL_SALE_PRICE',allowAuthorizedExceptions:false,windowDays:60}}),true)
})
test('nested policy errors link summary and inline controls; read-only and pending do not permit editing',()=>{
  const field='returns.policy.enabledResolutions',message='Selecciona al menos una resolución.'
  const view=renderConfig({section:'devoluciones',values:{'returns.policy':{...policy,enabledResolutions:[]}},errors:{devoluciones:{[field]:message}}})
  assert.match(view.html,/href="#returns\.policy\.enabledResolutions"/);assert.match(view.html,/id="returns\.policy\.enabledResolutions-error"/)
  assert.match(view.html,/aria-describedby="returns\.policy\.enabledResolutions-error"/)
  for(const options of [{canManage:false},{pending:true}]) assert.equal(input(renderConfig({section:'devoluciones',...options}),'returns.policy.windowDays').props.disabled,true)
})
test('return policy draft validation, persistence failures and other section drafts retain their established guards',async()=>{
  const context={userId:'U',companyId:'A',branchId:'BA',ready:true,canRead:true,canManage:true,consolidated:false},writes=[]
  let fail=true
  const h=configHarness({getSettings:async()=>({'returns.policy':policy,company_nit:'Original'}),updateSettings:async p=>{writes.push(p);if(fail)throw Error('No guardado');return p},refresh:async()=>false},context)
  try{
    h.render();await flush();h.render();h.value().setField('fiscal','company_nit','Borrador fiscal')
    h.value().setField('devoluciones','returns.policy',{...policy,enabledResolutions:[]});h.render()
    assert.equal(await h.value().save('devoluciones'),'invalid');assert.equal(writes.length,0)
    h.value().setField('devoluciones','returns.policy',{...policy,windowDays:'45'});h.render()
    assert.equal(h.value().errors.devoluciones['returns.policy.enabledResolutions'],undefined)
    assert.equal(await h.value().save('devoluciones'),'failed');h.render();assert.equal(h.value().drafts.devoluciones['returns.policy'].windowDays,'45')
    fail=false;assert.equal(await h.value().save('devoluciones'),'saved-refresh-failed');h.render()
    assert.deepEqual(writes.at(-1),{'returns.policy':{...policy,windowDays:45}})
    assert.equal(h.value().drafts.fiscal.company_nit,'Borrador fiscal');assert.equal(h.value().dirty('devoluciones'),false)
  }finally{h.unmount()}
})
test('late policy saves cannot overwrite a new company generation or permit obsolete callbacks',async()=>{
  const context={userId:'U',companyId:'A',branchId:'BA',ready:true,canRead:true,canManage:true,consolidated:false},done=deferred(),writes=[]
  const h=configHarness({getSettings:async()=>({'returns.policy':policy}),updateSettings:async(p,o)=>{writes.push([p,o]);return done.promise}},context)
  try{
    h.render();await flush();h.render();h.value().setField('devoluciones','returns.policy',{...policy,windowDays:45});h.render()
    const old=h.value(),saving=old.save('devoluciones')
    h.context({...context,companyId:'B',branchId:'BB'});h.render();await flush();h.render()
    h.context(context);h.render();await flush();h.render();done.resolve({'returns.policy':{...policy,windowDays:45}})
    assert.equal(await saving,'ignored');h.render();assert.equal(h.value().drafts.devoluciones['returns.policy'].windowDays,60)
    assert.equal(await old.save('devoluciones'),'ignored');assert.equal(writes.length,1);assert.deepEqual(writes[0][1],{scope:{companyId:'A',branchId:'BA'}})
  }finally{h.unmount()}
})

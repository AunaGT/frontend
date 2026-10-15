const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')
test('billing preview and prepare have separate scoped endpoints and forward abort signals',async()=>{
  const calls=[],api=loadReportModule('../appointments/commercialApi.ts',{'./api':{mutateAgenda:async(...args)=>{calls.push(args);return {}}}})
  assert.equal(typeof api.previewSourceBilling,'function');assert.equal(typeof api.prepareSourceBilling,'function')
  const scope={companyId:'c',branchId:'b'},origin={kind:'BOOKING',id:'a/b'},signal=new AbortController().signal
  await api.previewSourceBilling(scope,origin,{},signal)
  await api.prepareSourceBilling(scope,{kind:'ACTIVITY',id:'a/b'},{contactId:'c',quantity:'1',expectedVersion:1,reviewHash:'h',idempotencyKey:'k'},signal)
  assert.equal(calls[0][0],'/billing-sources/bookings/a%2Fb/preview');assert.equal(calls[1][0],'/billing-sources/activities/a%2Fb/prepare')
  assert.equal(calls[0][1],scope);assert.equal(calls[0][3],signal);assert.deepEqual(calls[0][2],{})
})
test('refreshing a changed commercial preview requires a new explicit review without discarding customer or quantity',()=>{
  const h=hookHarness()
  const {useSourceBillingDraft}=loadReportModule('../appointments/billingDraft.ts',{react:h.hooks,'./api':{},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})}})
  let preview={origin:{kind:'ACTIVITY',id:'e',version:2},reviewHash:'old',canPrepare:true,engagementId:null}
  const render=()=>h.render(()=>useSourceBillingDraft({scope:{companyId:'c',branchId:'b'},origin:{kind:'ACTIVITY',id:'e'},preview,onSaved(){}}))
  render().change({contactId:'customer',quantity:'0.5'});render().approve(true);assert.equal(render().approved,true)
  preview={...preview,reviewHash:'new',origin:{...preview.origin,version:3}}
  assert.equal(render().approved,false);assert.equal(render().choices.quantity,'0.5');assert.equal(render().choices.contactId,'customer')
})
test('billing draft requires explicit review, keeps failed input and retry key, and ignores old tenant responses',async()=>{
  const h=hookHarness(),calls=[],saved=[];let reject,resolve,scope={companyId:'a',branchId:'b'}
  const {useSourceBillingDraft}=loadReportModule('../appointments/billingDraft.ts',{react:h.hooks,'./api':{mutateAgenda:async(path,scope,body)=>{calls.push({path,scope,body});return new Promise((res,rej)=>{resolve=res;reject=rej})}},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})}})
  const preview={origin:{kind:'ACTIVITY',id:'event',version:2},reviewHash:'hash',canPrepare:true,engagementId:null}
  const render=()=>h.render(()=>useSourceBillingDraft({scope,origin:{kind:'ACTIVITY',id:'event'},preview,onSaved:value=>saved.push(value)}))
  await render().save();assert.equal(calls.length,0)
  render().change({contactId:'client',quantity:'0.5'});assert.equal(render().approved,false)
  render().approve(true);const first=render().save();await render().save();assert.equal(calls.length,1)
  reject(Error('El contexto cambió'));await first;assert.equal(render().choices.quantity,'0.5')
  const retry=render().save();reject(Error('Retry'));await retry
  assert.equal(calls[0].body.idempotencyKey,calls[1].body.idempotencyKey)
  render().change({contactId:'another',quantity:'1'});assert.equal(render().approved,false)
  render().approve(true);const late=render().save();scope={companyId:'new',branchId:'new'};render();resolve({id:'old'});await late
  assert.deepEqual(saved,[]);assert.deepEqual(render().choices,{quantity:'1'})
})

const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('commercial programming draft preserves programs and retry key, rejects a duplicate submit and ignores old-tenant responses',async()=>{
  const h=hookHarness(),writes=[],saved=[];let scope={companyId:'a',branchId:'b'},resolve,reject
  const api={appointmentQueryKey:()=>[],mutateAgenda:async(path,scoped,body)=>{writes.push({path,scope:scoped,body});return new Promise((res,rej)=>{resolve=res;reject=rej})}}
  let useEngagementDraft
  try{({useEngagementDraft}=loadReportModule('../appointments/engagementDraft.ts',{react:h.hooks,'./api':api,'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})}}))}catch(e){if(!e.message.includes('ENOENT'))throw e}
  assert.equal(typeof useEngagementDraft,'function')
  const render=()=>h.render(()=>useEngagementDraft({scope,engagementId:'e',version:2,onSaved:value=>saved.push(value)}))
  render().change([{lineId:'l',quantity:'0.5',startsAt:'2030-01-01T15:00Z'}])
  const first=render().save(true);await render().save(true);assert.equal(writes.length,1)
  reject(Error('Horario ocupado'));await first
  assert.equal(render().programs[0].quantity,'0.5')
  const retry=render().save(true);reject(Error('Horario ocupado'));await retry
  assert.equal(writes[0].body.idempotencyKey,writes[1].body.idempotencyKey)
  const late=render().save(true);scope={companyId:'c',branchId:'d'};render();resolve({id:'old'});await late
  assert.deepEqual(saved,[]);assert.equal(render().programs.length,0)
})
test('programming accepts a newer version only after deliberate review and retains selected dates',()=>{
  const h=hookHarness()
  const {useEngagementDraft}=loadReportModule('../appointments/engagementDraft.ts',{react:h.hooks,'./api':{},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})}})
  const render=()=>h.render(()=>useEngagementDraft({scope:{companyId:'a',branchId:'b'},engagementId:'e',version:2,onSaved(){}}))
  render().change([{lineId:'s',quantity:'1',startsAt:'2030-01-01T15:00Z'}])
  assert.equal(typeof render().reviewVersion,'function')
  render().reviewVersion(3)
  assert.equal(render().handoff().version,3);assert.equal(render().programs[0].startsAt,'2030-01-01T15:00Z')
})
test('commercial money attempts keep the reviewed version and retry key until explicit context review',async()=>{
  const h=hookHarness(),writes=[]
  const {useEngagementCommand}=loadReportModule('../appointments/engagementDraft.ts',{react:h.hooks,'./api':{mutateAgenda:async(path,scope,body)=>{writes.push(body);throw Error('Retry')}},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})}})
  assert.equal(typeof useEngagementCommand,'function')
  let version=2
  const render=()=>h.render(()=>useEngagementCommand({scope:{companyId:'a',branchId:'b'},engagementId:'e',version}))
  await render().send('payments',{amount:'40.00',paymentMethodId:1})
  version=3
  await render().send('payments',{amount:'40.00',paymentMethodId:1})
  assert.equal(writes[0].idempotencyKey,writes[1].idempotencyKey);assert.equal(writes[1].expectedVersion,2)
  render().reviewVersion(3)
  await render().send('payments',{amount:'40.00',paymentMethodId:1})
  assert.equal(writes[2].expectedVersion,3);assert.notEqual(writes[2].idempotencyKey,writes[1].idempotencyKey)
})
test('commercial writes invalidate the actual order, receivable and cash-turn consumers',async()=>{
  const h=hookHarness(),invalidated=[]
  const {useEngagementCommand}=loadReportModule('../appointments/engagementDraft.ts',{react:h.hooks,'./api':{mutateAgenda:async()=>({id:'e'})},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async({queryKey})=>invalidated.push(queryKey)})}})
  const command=h.render(()=>useEngagementCommand({scope:{companyId:'a',branchId:'b'},engagementId:'e',version:1}))
  await command.send('payments',{amount:'10.00',paymentMethodId:1})
  for(const prefix of ['order','orders','cash-session','cash-sessions','receivables','quote','sales'])assert.ok(invalidated.some(key=>key[0]===prefix),prefix)
})

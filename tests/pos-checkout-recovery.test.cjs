const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {deferred}=require('./helpers/configHarness.cjs')
const scope={companyId:'A',branchId:'B',userId:'U'}
const notObserved=()=>Object.assign(Error('El resultado aún no está disponible'),{status:404,data:{code:'CHECKOUT_NOT_OBSERVED'}})
function fixture(overrides={}){
 const map=new Map(),states=[],confirmed=[];let posts=0
 const {createCheckoutFlow}=loadReportModule('../sales/checkout/checkoutFlow.ts')
 const deps={scope,storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},isCurrent:()=>true,withLock:async run=>run(),newKey:()=> 'K',onState:s=>states.push(s),onConfirmed:a=>confirmed.push(a.saleId),submit:async()=>{posts++;return{id:'V'}},lookup:async()=>{throw notObserved()},...overrides}
 return {flow:createCheckoutFlow(deps),deps,states,confirmed,posts:()=>posts}
}
test('lost checkout retains the original failure after reload and lookup failures',async()=>{
 const a=fixture({submit:async()=>{throw Error('No se pudo conectar con la base')},lookup:async()=>{throw notObserved()}})
 await a.flow.submit('SALE',{items:[{product_id:'P',qty:'1.25',price:'10'}]})
 assert.equal(a.flow.getState().attempt.lastError,'No se pudo conectar con la base')
 const b=fixture({...a.deps});await b.flow.reconcile()
 assert.equal(b.flow.getState().attempt.lastError,'No se pudo conectar con la base')
})

for(const kind of ['SALE','ORDER'])test(`manual ${kind} retry uses the frozen original key and payload, not a new checkout`,async()=>{
 const sent=[],payload=kind==='SALE'?{items:[{product_id:'P',qty:'0.125',price:'7.123456',presentation_id:'box',unit_revision:3}],amount_received:'10'}:{lines:[{order_item_id:'L',qty:'2'}],payment_method_id:7}
 let fail=true
 const a=fixture({newKey:()=> 'original-key',submit:async(k,p,orderId)=>{sent.push({kind:k,p:structuredClone(p),orderId});if(fail)throw Error('network');return{id:'V'}},lookup:async()=>{throw notObserved()}})
 await a.flow.submit(kind,payload,kind==='ORDER'?'O':undefined)
 payload.changed='must not send';fail=false
 const b=fixture({...a.deps,newKey:()=>assert.fail('retry cannot create a key')})
 assert.equal(b.flow.canRetry(),true);await b.flow.retry()
 assert.equal(sent.length,2);assert.deepEqual(sent[1],sent[0]);assert.equal(sent[1].p.idempotency_key,'original-key')
 assert.deepEqual(a.confirmed,['V']);assert.equal(b.flow.canRetry(),false)
})

test('retry checks a committed sale first and never reposts it',async()=>{
 let posts=0
 const a=fixture({submit:async()=>{posts++;throw Error('network')},lookup:async()=>{throw notObserved()}});await a.flow.submit('SALE',{})
 const b=fixture({...a.deps,lookup:async()=>({state:'CONFIRMED',kind:'SALE',saleId:'V'})})
 await b.flow.retry();assert.equal(posts,1);assert.deepEqual(a.confirmed,['V'])
})

for(const error of [Object.assign(Error('other route'),{status:404}),Object.assign(Error('unauthorized'),{status:401}),Object.assign(Error('server'),{status:500}),Error('offline')])test(`retry refuses to post after lookup failure: ${error.message}`,async()=>{
 let posts=0
 const a=fixture({submit:async()=>{posts++;throw Error('network')}});await a.flow.submit('SALE',{})
 const b=fixture({...a.deps,lookup:async()=>{throw error}});await b.flow.retry()
 assert.equal(posts,1);assert.equal(b.flow.getState().attempt.state,'UNKNOWN');assert.equal(b.flow.getState().error,error.message)
})

test('double retry while lookup is pending posts the original operation only once',async()=>{
 const a=fixture({submit:async()=>{throw Error('network')}});await a.flow.submit('SALE',{})
 const gate=deferred();let posts=0
 const b=fixture({...a.deps,lookup:()=>gate.promise,submit:async()=>{posts++;return{id:'V'}}})
 const first=b.flow.retry(),second=b.flow.retry();await second;gate.reject(notObserved());await first
 assert.equal(posts,1)
})

test('scope revoked during retry lookup prevents submitting or clearing the saved attempt',async()=>{
 const a=fixture({submit:async()=>{throw Error('network')}});await a.flow.submit('SALE',{})
 const gate=deferred();let current=true,posts=0
 const b=fixture({...a.deps,isCurrent:()=>current,lookup:()=>gate.promise,submit:async()=>{posts++;return{id:'V'}}})
 const pending=b.flow.retry();current=false;gate.reject(notObserved());await pending
 assert.equal(posts,0)
 assert.equal(loadReportModule('../sales/checkout/attemptStorage.ts').loadCheckoutAttempt(scope,a.deps.storage).key,'K')
})

test('completion in another tab during retry lookup cannot be downgraded or posted again',async()=>{
 const a=fixture({submit:async()=>{throw Error('network')}});await a.flow.submit('SALE',{})
 const gate=deferred();let posts=0
 const b=fixture({...a.deps,lookup:()=>gate.promise,submit:async()=>{posts++;return{id:'V'}}})
 const pending=b.flow.retry()
 const c=fixture({...a.deps,lookup:async()=>({state:'CONFIRMED',kind:'SALE',saleId:'V'})});await c.flow.reconcile()
 gate.reject(notObserved());await pending
 assert.equal(posts,0);assert.equal(b.flow.getState().attempt.state,'CONFIRMED')
})

test('legacy metadata and confirmed markers are not retryable requests',async()=>{
 const {saveCheckoutAttempt}=loadReportModule('../sales/checkout/attemptStorage.ts')
 for(const attempt of [{state:'UNKNOWN'},{state:'CONFIRMED',saleId:'V',version:2,payload:{}},{state:'UNKNOWN',version:2,payload:[]},{state:'UNKNOWN',version:2,payload:{},kind:'ORDER'}]){
  let posts=0;const a=fixture({submit:async()=>{posts++;return{id:'V'}}})
  saveCheckoutAttempt(scope,{...scope,key:'K',kind:'SALE',...attempt},a.deps.storage)
  const b=fixture({...a.deps});assert.equal(b.flow.canRetry(),false);await b.flow.retry();assert.equal(posts,0)
 }
})

test('retry cannot overwrite a newer attempt while its lookup was pending',async()=>{
 const a=fixture({submit:async()=>{throw Error('network')}});await a.flow.submit('SALE',{})
 const gate=deferred();let posts=0
 const b=fixture({...a.deps,lookup:()=>gate.promise,submit:async()=>{posts++;return{id:'V'}}})
 const pending=b.flow.retry(),api=loadReportModule('../sales/checkout/attemptStorage.ts')
 api.saveCheckoutAttempt(scope,{...scope,key:'NEW',kind:'SALE',state:'UNKNOWN',version:2,payload:{items:['different']}},a.deps.storage)
 gate.reject(notObserved());await pending
 assert.equal(posts,0);assert.equal(api.loadCheckoutAttempt(scope,a.deps.storage).key,'NEW')
})

test('retry stops before posting when saving the recovery marker fails',async()=>{
 const a=fixture({submit:async()=>{throw Error('network')}});await a.flow.submit('SALE',{})
 let posts=0
 const b=fixture({...a.deps,lookup:async()=>{throw notObserved()},storage:{...a.deps.storage,setItem(){throw Error('quota')}},submit:async()=>{posts++;return{id:'V'}}})
 await b.flow.retry();assert.equal(posts,0);assert.match(b.flow.getState().error,/guardar|recuper/i)
})

for(const conflict of [false,true])test(`retry ${conflict?'conflict preserves the existing recovery':'definitive rejection releases only its attempt'}`,async()=>{
 const a=fixture({submit:async()=>{throw Error('network')}});await a.flow.submit('SALE',{})
 const b=fixture({...a.deps,lookup:async()=>{throw notObserved()},submit:async()=>{throw Object.assign(Error('disabled method'),{status:409,data:conflict?{code:'CHECKOUT_CONFLICT'}:{checkoutRejected:true}})}})
 await b.flow.retry()
 assert.equal(b.flow.getState().attempt?.state??null,conflict?'UNKNOWN':null)
 if(!conflict)assert.equal(b.flow.getState().error,'disabled method')
})

for(const mode of ['submit','retry'])test(`${mode} rejection cleanup rechecks concurrent confirmation inside the final lock`,async()=>{
 const original=fixture({submit:async()=>{throw Error('network')}})
 if(mode==='retry')await original.flow.submit('SALE',{})
 const entered=deferred(),release=deferred();let locks=0
 const f=fixture({storage:original.deps.storage,submit:async()=>{throw Object.assign(Error('rejected'),{status:403})},lookup:async()=>{throw notObserved()},withLock:async run=>{if(++locks===3){entered.resolve();await release.promise}return run()}})
 const pending=mode==='submit'?f.flow.submit('SALE',{}):f.flow.retry()
 await entered.promise
 const api=loadReportModule('../sales/checkout/attemptStorage.ts'),attempt=api.loadCheckoutAttempt(scope,f.deps.storage)
 api.saveCheckoutAttempt(scope,{...attempt,state:'CONFIRMED',saleId:'V'},f.deps.storage)
 release.resolve();await pending
 assert.equal(api.loadCheckoutAttempt(scope,f.deps.storage)?.state,'CONFIRMED')
 assert.equal(f.flow.getState().attempt?.saleId,'V')
})

for(const mode of ['submit','retry'])test(`${mode} rejection never treats an unrelated lookup 404 as authoritative absence`,async()=>{
 const original=fixture({submit:async()=>{throw Error('network')}})
 if(mode==='retry')await original.flow.submit('SALE',{})
 let lookups=0
 const f=fixture({storage:original.deps.storage,submit:async()=>{throw Object.assign(Error('rejected'),{status:403})},lookup:async()=>{if(mode==='retry'&&++lookups===1)throw notObserved();throw Object.assign(Error('lookup route missing'),{status:404})}})
 if(mode==='submit')await f.flow.submit('SALE',{});else await f.flow.retry()
 assert.equal(f.flow.getState().attempt?.state,'UNKNOWN')
})

test('automatic recovery surfaces the lookup failure separately from the persisted send failure',async()=>{
 const f=fixture({submit:async()=>{throw Error('sending timed out')},lookup:async()=>{throw Object.assign(Error('lookup database unavailable'),{status:500})}})
 await f.flow.submit('SALE',{})
 assert.equal(f.flow.getState().attempt.lastError,'sending timed out')
 assert.equal(f.flow.getState().error,'lookup database unavailable')
})
test('double submit before render sends one checkout and confirms once',async()=>{
 const gate=deferred(),f=fixture({submit:()=>gate.promise});const first=f.flow.submit('SALE',{}),second=f.flow.submit('SALE',{});await second;gate.resolve({id:'V'});await first;assert.deepEqual(f.confirmed,['V'])
})
test('lost response recovers committed sale without a second checkout',async()=>{
 const f=fixture({submit:async()=>{throw Error('network')},lookup:async()=>({state:'CONFIRMED',saleId:'V',kind:'SALE'})})
 await f.flow.submit('SALE',{});assert.deepEqual(f.confirmed,['V']);assert.equal(f.states.at(-1).attempt,null)
})
test('not-observed after timeout remains unknown and cannot start a different checkout',async()=>{
 let posts=0;const f=fixture({submit:async()=>{posts++;throw Error('timeout')}})
 await f.flow.submit('SALE',{});await f.flow.reconcile();await f.flow.submit('SALE',{items:['new']});assert.equal(posts,1);assert.equal(f.states.at(-1).attempt.state,'UNKNOWN')
})
test('definite rejected input releases the attempt only after no sale is observed',async()=>{
 const f=fixture({submit:async()=>{throw Object.assign(Error('invalid'),{status:400})}});await f.flow.submit('SALE',{});assert.equal(f.states.at(-1).attempt,null);assert.equal(f.states.at(-1).error,'invalid')
})
test('old owner response is persisted for recovery but cannot clear the new owner cart',async()=>{
 const gate=deferred();let current=true;const f=fixture({submit:()=>gate.promise,isCurrent:()=>current});const p=f.flow.submit('SALE',{});await new Promise(r=>setImmediate(r));current=false;gate.resolve({id:'V'});await p;assert.deepEqual(f.confirmed,[])
 current=true;const fresh=fixture({...f.deps,lookup:async()=>({state:'CONFIRMED',saleId:'V',kind:'SALE'}),onConfirmed:a=>f.confirmed.push(a.saleId)});await fresh.flow.reconcile();assert.deepEqual(f.confirmed,['V'])
})
test('storage failure prevents mutation and confirmation cleanup failure never reposts',async()=>{
 const f=fixture({storage:{getItem:()=>null,setItem(){throw Error('quota')},removeItem(){}}});await f.flow.submit('SALE',{});assert.equal(f.posts(),0)
 const g=fixture({onConfirmed:()=>{throw Error('cleanup')}});await g.flow.submit('SALE',{});assert.equal(g.posts(),1);assert.equal(g.states.at(-1).attempt.state,'CONFIRMED');await g.flow.submit('SALE',{});assert.equal(g.posts(),1)
})
test('a definitive business rejection does not leave a permanent unknown checkout',async()=>{
 const f=fixture({submit:async()=>{throw Object.assign(Error('disabled method'),{status:409,data:{checkoutRejected:true}})}})
 await f.flow.submit('SALE',{});assert.equal(f.states.at(-1).attempt,null)
})
test('completion during lost-response recovery cannot be downgraded when cleanup fails',async()=>{
 const f=fixture({submit:async()=>{throw Error('timeout')},lookup:async()=>({state:'CONFIRMED',saleId:'V',kind:'SALE'}),onConfirmed:()=>{throw Error('cleanup')}})
 await f.flow.submit('SALE',{});assert.equal(f.states.at(-1).attempt.state,'CONFIRMED');assert.equal(f.states.at(-1).attempt.saleId,'V')
})
test('a second tab queued before completion cannot charge again after the pending marker clears',async()=>{
 const a=fixture(),gate=deferred();const b=fixture({...a.deps,onConfirmed:()=>{},withLock:async run=>{await gate.promise;return run()}})
 const first=a.flow.submit('SALE',{}),second=b.flow.submit('SALE',{})
 await first;gate.resolve();await second
 assert.equal(a.posts(),1);assert.equal(a.states.at(-1).attempt.saleId,'V')
})
test('restoring a locally confirmed attempt still checks its authorized server result',async()=>{
 const a=fixture({onConfirmed:()=>{throw Error('closed before cleanup')}});await a.flow.submit('SALE',{})
 let confirmed=0;const b=fixture({...a.deps,onConfirmed:()=>confirmed++});await b.flow.reconcile();assert.equal(confirmed,0)
})
for(const fails of [false,true])test(`late old checkout ${fails?'failure':'confirmation'} preserves a newer attempt`,async()=>{
 const old=deferred(),next=deferred(),a=fixture({submit:()=>old.promise})
 const first=a.flow.submit('SALE',{});await new Promise(r=>setImmediate(r))
 const b=fixture({...a.deps,newKey:()=> 'K2',onConfirmed:()=>{},lookup:async()=>({state:'CONFIRMED',saleId:'V1',kind:'SALE'}),submit:()=>next.promise})
 await b.flow.reconcile();const second=b.flow.submit('SALE',{});await new Promise(r=>setImmediate(r))
 if(fails)old.reject(Error('timeout'));else old.resolve({id:'V1'})
 await first
 const {loadCheckoutAttempt}=loadReportModule('../sales/checkout/attemptStorage.ts')
 assert.ok(loadCheckoutAttempt(scope,a.deps.storage),'newer attempt must remain recoverable');assert.equal(loadCheckoutAttempt(scope,a.deps.storage).key,'K2');assert.equal(loadCheckoutAttempt(scope,a.deps.storage).state,'SUBMITTING')
 next.resolve({id:'V2'});await second
})

const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {deferred}=require('./helpers/configHarness.cjs')
const scope={companyId:'A',branchId:'B',userId:'U'}
function fixture(overrides={}){
 const map=new Map(),states=[],confirmed=[];let posts=0
 const {createCheckoutFlow}=loadReportModule('../sales/checkout/checkoutFlow.ts')
 const deps={scope,storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},isCurrent:()=>true,withLock:async run=>run(),newKey:()=> 'K',onState:s=>states.push(s),onConfirmed:a=>confirmed.push(a.saleId),submit:async()=>{posts++;return{id:'V'}},lookup:async()=>{throw Object.assign(Error('not observed'),{status:404})},...overrides}
 return {flow:createCheckoutFlow(deps),deps,states,confirmed,posts:()=>posts}
}
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

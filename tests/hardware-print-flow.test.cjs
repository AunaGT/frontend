const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{deferred}=require('./helpers/configHarness.cjs')
const make=()=>loadReportModule('../config/hardware/printing/flow.ts').createPrintFlow
function fixture(){const calls=[],state=[],job={id:'J',state:'CREATED'},deps={current:()=>true,create:async()=>job,document:async()=>({version:1}),event:async(id,event)=>{calls.push(event);return{...job,id,state:event}},reprint:async()=>({...job,id:'COPY'}),render:async()=>({blob:new Blob(['pdf']),filename:'ticket.pdf'}),save:()=>calls.push('SAVE'),update:s=>state.push(s)};return{deps,calls,state}}
test('preparation and download never claim paper printed; copy reuses the job source',async()=>{
 const h=fixture(),flow=make()(h.deps);await flow.prepare({kind:'SALE_TICKET',id:'S'},{})
 assert.equal(flow.state().job.state,'PREPARED');assert.deepEqual(h.calls,['PREPARED'])
 await flow.download();assert.deepEqual(h.calls,['PREPARED','DOWNLOAD_REQUESTED','SAVE'])
 await flow.retry('J','Otra copia');assert.equal(flow.state().job.id,'COPY')
})
test('changed owner prevents stale render and download',async()=>{
 const h=fixture(),done=deferred();let current=true;h.deps.current=()=>current;h.deps.render=()=>done.promise
 const flow=make()(h.deps),pending=flow.prepare({kind:'SALE_TICKET',id:'S'},{})
 await Promise.resolve();await Promise.resolve();current=false;done.resolve({blob:new Blob(['old']),filename:'old.pdf'});await pending
 assert.equal(flow.state().blob,null);await flow.download();assert.deepEqual(h.calls,[])
})
test('render failure records fixed error and cannot download; repeated clicks share one operation',async()=>{
 const h=fixture(),done=deferred();let creates=0;h.deps.create=async()=>{creates++;await done.promise;return{id:'J'}};h.deps.render=async()=>{throw Error('font failed')}
 const flow=make()(h.deps),a=flow.prepare({kind:'SALE_TICKET',id:'S'},{}),b=flow.prepare({kind:'SALE_TICKET',id:'S'},{})
 done.resolve();await Promise.all([a,b]);assert.equal(creates,1);assert.equal(flow.state().blob,null);assert.equal(flow.state().error,'font failed');assert.deepEqual(h.calls,['FAILED'])
})
test('denied or invalid source never unlocks cached-PDF fallback; recording outage does',async()=>{
 for(const status of [400,401,403,404,409,422,500,undefined]){
  const h=fixture();h.deps.create=async()=>{throw Object.assign(Error('request failed'),{status})}
  const flow=make()(h.deps);await flow.prepare({kind:'LABEL_PREPARATION',id:'P'},{})
  assert.equal(flow.state().fallbackAvailable,status===500||status===undefined,`status ${status}`)
 }
 const h=fixture();h.deps.render=async()=>{throw Error('bad source')};const flow=make()(h.deps);await flow.prepare({kind:'LABEL_PREPARATION',id:'P'},{});assert.equal(flow.state().fallbackAvailable,false)
})

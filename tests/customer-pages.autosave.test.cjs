const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const record=()=>({id:'design',name:'Nombre',revision:1,design:{nodes:[]}})
const pause=()=>new Promise(r=>setImmediate(r))
test('edits coalesce, one save is in flight, and late responses do not mark later edits saved',async()=>{
 const {DraftSaveQueue}=loadReportModule('../config/customerPages/draftSaveQueue.ts'),requests=[],jobs=[]
 const q=new DraftSaveQueue(record(),input=>new Promise(resolve=>{requests.push(input);jobs.push(resolve)}),()=>{})
 for(let i=0;i<10;i++)q.edit({name:'Nombre '+i,design:{nodes:[]}})
 const first=q.flush();assert.equal(requests.length,1)
 q.edit({name:'Posterior',design:{nodes:[]}});assert.equal(q.dirty,true)
 jobs.shift()({...record(),revision:2,name:'Nombre 9'});await pause();assert.equal(requests.length,2);assert.equal(requests[1].expectedRevision,2);assert.equal(q.dirty,true)
 jobs.shift()({...record(),revision:3,name:'Posterior'});await first;assert.equal(q.dirty,false);assert.equal(q.record.revision,3)
})
test('failure preserves exportable edits and disposal prevents a late cross-scope response',async()=>{
 const {DraftSaveQueue}=loadReportModule('../config/customerPages/draftSaveQueue.ts');let reject
 const q=new DraftSaveQueue(record(),()=>new Promise((_r,j)=>reject=j),()=>{});q.edit({name:'Sin guardar',design:{nodes:[]}})
 const pending=q.flush();reject(Object.assign(Error('Conflicto'),{status:409}));await assert.rejects(pending);assert.equal(q.dirty,true);assert.equal(q.conflict,true);assert.equal(q.local.name,'Sin guardar')
 let done;const other=new DraftSaveQueue(record(),()=>new Promise(r=>done=r),()=>{});other.edit({name:'Otra',design:{nodes:[]}});const late=other.flush();other.dispose();done({...record(),revision:99});await late;assert.equal(other.record.revision,1)
})

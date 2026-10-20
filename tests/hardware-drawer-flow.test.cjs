const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{deferred}=require('./helpers/configHarness.cjs')
const create=()=>loadReportModule('../config/hardware/drawer/flow.ts').createDrawerSimulation
test('simulation is explicit, deduplicates double click and never touches a payment or print operation',async()=>{
 const calls=[],done=deferred(),flow=create()({current:()=>true,find:async()=>{calls.push('find');await done.promise;return{items:[{id:'I',state:'PENDING',workstationId:'W'}]}},claim:async()=>{calls.push('claim');return{attemptId:'A',claimToken:'T'}},result:async()=>{calls.push('SIMULATED');return{state:'SIMULATED'}},update(){}})
 assert.deepEqual(calls,[]);const a=flow.simulateForSource({sourceType:'SALE',sourceId:'S'}),b=flow.simulateForSource({sourceType:'SALE',sourceId:'S'});done.resolve();await Promise.all([a,b]);assert.deepEqual(calls,['find','claim','SIMULATED']);assert.match(flow.state().message,/no se envió ningún pulso/i)
})
test('lost claim confirmation is unknown and never automatically retried',async()=>{
 let claims=0;const flow=create()({current:()=>true,find:async()=>({items:[{id:'I',state:'PENDING',workstationId:'W'}]}),claim:async()=>{claims++;throw Error('network')},result:async()=>{throw Error('unexpected')},update(){}})
 await flow.simulateForSource({sourceType:'SALE',sourceId:'S'});assert.equal(claims,1);assert.equal(flow.state().outcome,'UNKNOWN');await flow.simulateForSource({sourceType:'SALE',sourceId:'S'});assert.equal(claims,1)
})
test('owner change after query cannot claim for an old user or company',async()=>{
 let current=true,claims=0;const flow=create()({current:()=>current,find:async()=>{current=false;return{items:[{id:'I',state:'PENDING',workstationId:'W'}]}},claim:async()=>{claims++;return{}},result:async()=>({}),update(){}})
 await flow.simulateForSource({sourceType:'SALE',sourceId:'S'});assert.equal(claims,0)
})

const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('late integration responses cannot reveal a key in another company or session',async()=>{
 let company='a',session='s1',resolve,calls=0
 const {integrationRequest}=loadReportModule('../config/integrations/api.ts',{
  '@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=> 'b',apiFetch:async()=>{calls++;return new Promise(r=>{resolve=r})}},
  '@/services/authSession':{authSessionIdentity:()=>session,authSessionMatches:()=>true}
 })
 const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s1'},pending=integrationRequest(scope,'',{method:'POST',body:'{}'})
 company='other';resolve({apiKey:'PRIVATE'});await assert.rejects(()=>pending,{name:'AbortError'})
 await assert.rejects(()=>integrationRequest(scope,''),{name:'AbortError'});assert.equal(calls,1)
 company='a';session='s2';await assert.rejects(()=>integrationRequest(scope,''),{name:'AbortError'})
})
test('aborted or logged-out integration requests never deliver a late one-shot secret',async()=>{
 let resolve,loggedIn=true
 const {integrationRequest}=loadReportModule('../config/integrations/api.ts',{
  '@/services/api':{getActiveCompanyId:()=> 'a',getActiveBranchId:()=> 'b',apiFetch:async()=>new Promise(r=>resolve=r)},
  '@/services/authSession':{authSessionIdentity:()=> 's',authSessionMatches:()=>loggedIn}
 })
 const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'},abort=new AbortController(),pending=integrationRequest(scope,'',{signal:abort.signal})
 abort.abort();resolve({apiKey:'PRIVATE'});await assert.rejects(()=>pending,{name:'AbortError'})
 const second=integrationRequest(scope,'');loggedIn=false;resolve({apiKey:'PRIVATE'});await assert.rejects(()=>second,{name:'AbortError'})
})

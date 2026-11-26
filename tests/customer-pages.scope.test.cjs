const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('API refuses a different tenant before and after asynchronous completion',async()=>{
 let company='a',session='s',finish,calls=0
 const api=loadReportModule('../config/customerPages/api.ts',{'@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=>null,apiFetch:()=>{calls++;return new Promise(r=>finish=r)}},'@/services/authSession':{authSessionIdentity:()=>session,authSessionMatches:()=>true}})
 const scope={companyId:'a',userId:'u',sessionId:'s'},request=api.getPortalDraft(scope,'id');company='b';finish({name:'Private'});await assert.rejects(request,e=>e.name==='AbortError')
 await assert.rejects(()=>api.getPortalDraft(scope,'id'),e=>e.name==='AbortError');assert.equal(calls,1)
})

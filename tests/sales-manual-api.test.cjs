const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
function setup(){let active={companyId:'A',branchId:'B',userId:'U'},identity='session';const calls=[]
 const api=loadReportModule('../sales/manualSalesApi.ts',{'@/services/api':{getActiveCompanyId:()=>active.companyId,getActiveBranchId:()=>active.branchId,apiFetch:async(path,options)=>{calls.push({path,options});return{id:'V'}}},'@/services/authSession':{authSessionMatches:id=>active.userId===id,authSessionIdentity:()=>identity}})
 return{api,calls,scope:{companyId:'A',branchId:'B',userId:'U'},change:()=>active.companyId='OTHER',session:()=>identity='changed'}
}
test('new sale saves a draft through scoped transport, never the POS checkout',async()=>{
 const h=setup(),body={expectedVersion:0,idempotencyKey:'key',items:[]}
 await h.api.saveManualSale(h.scope,null,body);await h.api.saveManualSale(h.scope,'V',body);await h.api.confirmManualSale(h.scope,'V',body)
 assert.deepEqual(h.calls.map(c=>[c.path,c.options.method]),[['/sales/drafts','POST'],['/sales/V/draft','PUT'],['/sales/V/confirm','POST']])
 assert.deepEqual(h.calls[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'});assert.deepEqual(JSON.parse(h.calls[0].options.body),body)
})
test('manual transport blocks stale tenant, consolidated scope and cancelled requests',async()=>{
 const h=setup();h.change();await assert.rejects(h.api.readManualSale(h.scope,'V'),{name:'AbortError'});assert.equal(h.calls.length,0)
 const fresh=setup();await assert.rejects(fresh.api.saveManualSale({...fresh.scope,branchId:'all'},null,{}));assert.equal(fresh.calls.length,0)
 const controller=new AbortController();controller.abort();await assert.rejects(fresh.api.readManualSale(fresh.scope,'V',controller.signal),{name:'AbortError'})
})
test('session changed during a write prevents the old response from reaching the editor',async()=>{
 let generation='old'
 const api=loadReportModule('../sales/manualSalesApi.ts',{'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:async()=>{generation='new';return{id:'secret'}}},'@/services/authSession':{authSessionMatches:()=>true,authSessionIdentity:()=>generation}})
 await assert.rejects(api.saveManualSale({companyId:'A',branchId:'B',userId:'U'},null,{}),{name:'AbortError'})
})

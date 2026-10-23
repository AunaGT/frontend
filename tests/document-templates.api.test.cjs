const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('draft save sends only a draft command with explicit tenant and revision',async()=>{
  const writes=[]
  const api=loadReportModule('../config/documentTemplates/api.ts',{'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:async(path,options)=>{writes.push({path,...options});return{id:'draft'}}},'@/services/authSession':{authSessionIdentity:()=> 'session',authSessionMatches:()=>true}})
  await api.saveTemplate({companyId:'A',branchId:'B',userId:'U',sessionId:'session'},{id:'template',expectedVersion:4,name:'Diseño',design:{schemaVersion:1},requestKey:'save'})
  assert.equal(writes.length,1);assert.equal(writes[0].method,'PUT');assert.equal(writes[0].headers['X-Company-Id'],'A')
  assert.equal(JSON.parse(writes[0].body).expectedVersion,4);assert.equal(writes.some(w=>w.path.includes('/publish')),false)
})
test('a late response after tenant or session change is rejected before it can appear in the page',async()=>{
  let company='A',session='s1',release
  const api=loadReportModule('../config/documentTemplates/api.ts',{'@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=> 'B',apiFetch:()=>new Promise(r=>release=r)},'@/services/authSession':{authSessionIdentity:()=>session,authSessionMatches:()=>true}})
  const pending=api.templateRequest({companyId:'A',branchId:'B',userId:'U',sessionId:'s1'},'/schema')
  company='C';session='s2';release({private:true})
  await assert.rejects(pending,{name:'AbortError'})
})
test('read-only XML export uses the authorized read endpoint instead of the manage-only compiler',async()=>{
  const requests=[],before=global.fetch,api=loadReportModule('../config/documentTemplates/api.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:()=>assert.fail('XML export must not call the JSON compiler')},'@/services/authSession':{authSessionIdentity:()=> 'S',authSessionMatches:()=>true}})
  global.fetch=async(path,options)=>{requests.push({path,...options});return new Response('<plantilla-factura version="1"/>',{headers:{'Content-Type':'application/xml'}})}
  try{const source=await api.exportTemplateXml({companyId:'A',branchId:'B',userId:'U',sessionId:'S'},'T')
    assert.match(source,/plantilla-factura/);assert.equal(requests.length,1);assert.equal(requests[0].path,'/api/settings/document-templates/T/export');assert.equal(requests[0].method,undefined);assert.equal(requests[0].headers['X-Company-Id'],'A')
  }finally{global.fetch=before}
})

const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('dispute requests isolate tenant context, preserve attempts and reject a response cancelled during decoding',async()=>{
  const old=global.fetch,calls=[],scope={companyId:'company',branchId:'branch',actorId:'actor'},abort=new AbortController()
  global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({items:[]})}}
  try{
    const api=loadReportModule('../../services/cashDisputeService.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>'qa'}})
    await api.fetchDisputes(scope,{page:2,status:'LOST',q:'CB & 1'},abort.signal)
    await api.createDispute({eventId:'a/b',requestKey:'stable'},scope,abort.signal)
    await api.confirmDisputeEffect('a/b',{kind:'BANK_DEBIT',requestKey:'effect-stable'},scope,abort.signal)
    assert.match(calls[0].url,/status=LOST/);assert.match(calls[0].url,/q=CB\+%26\+1/)
    for(const {options}of calls){assert.equal(options.cache,'no-store');assert.equal(options.signal,abort.signal);assert.equal(options.headers['X-Company-Id'],'company');assert.equal(options.headers['X-Branch-Id'],'branch')}
    assert.equal(JSON.parse(calls[1].options.body).requestKey,'stable')
    assert.match(calls[2].url,/\/a%2Fb\/effects$/);assert.equal(JSON.parse(calls[2].options.body).requestKey,'effect-stable')
    global.fetch=async()=>({ok:true,json:async()=>{abort.abort();return {id:'private'}}})
    await assert.rejects(api.fetchDispute('a/b',scope,abort.signal),{name:'AbortError'})
  }finally{global.fetch=old}
})
test('case evidence uploads the file with its attempt key and opens through the case-scoped signed link',async()=>{
  const old=global.fetch,calls=[],scope={companyId:'company',branchId:'branch',actorId:'actor'}
  global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:'c1',url:'signed'})}}
  try{
    const api=loadReportModule('../../services/cashDisputeService.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=>'qa'}})
    const file=new File(['%PDF'],'carta.pdf',{type:'application/pdf'})
    await api.uploadDisputeEvidence('c/1',file,'attempt-1',scope)
    assert.equal(calls[0].url,'/api/cash-closures/disputes/c%2F1/evidence');assert.equal(calls[0].options.method,'POST')
    assert.equal(calls[0].options.body.get('requestKey'),'attempt-1');assert.equal(calls[0].options.body.get('file').name,'carta.pdf')
    assert.equal(calls[0].options.headers['Content-Type'],undefined,'the browser sets the multipart boundary');assert.equal(calls[0].options.headers['X-Branch-Id'],'branch')
    assert.deepEqual(await api.openDisputeEvidence('c1','e/1',scope),{id:'c1',url:'signed'})
    assert.equal(calls[1].url,'/api/cash-closures/disputes/c1/evidence/e%2F1')
  }finally{global.fetch=old}
})

const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('correction requests carry company and branch, disable cache and preserve cancellation and request keys',async()=>{
  const old=global.fetch,calls=[],scope={companyId:'company',branchId:'branch',actorId:'actor'},abort=new AbortController()
  global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({available:true})}}
  try{
    const api=loadReportModule('../../services/cashCorrectionService.ts',{'@/services/api':{getApiBaseUrl:()=>'/api',getAuthToken:()=> 'qa'}})
    await api.fetchCorrectionContext('a/b',scope,abort.signal)
    await api.proposeCorrection('a/b',{requestKey:'stable',lines:[]},scope,abort.signal)
    assert.match(calls[0].url,/a%2Fb\/corrections\/context$/)
    for(const {options}of calls){assert.equal(options.cache,'no-store');assert.equal(options.signal,abort.signal);assert.equal(options.headers['X-Company-Id'],'company');assert.equal(options.headers['X-Branch-Id'],'branch')}
    assert.equal(JSON.parse(calls[1].options.body).requestKey,'stable')
  }finally{global.fetch=old}
})

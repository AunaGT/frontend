const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('POS ticket transport sends scoped opt-in and exactly one grouped download request',async()=>{
 const calls=[],scope={companyId:'C',branchId:'B',userId:'U'}
 const api=loadReportModule('../config/hardware/printing/api.ts',{'@/services/api':{apiFetch:async(path,options)=>{calls.push({path,options});return path.includes('includeDocument')?{job:{id:'J'},document:{version:1}}:{id:'J',state:'DOWNLOAD_REQUESTED'}}},'../api':{assertHardwareScope(){}}})
 assert.equal(typeof api.createPrintJobWithDocument,'function')
 const result=await api.createPrintJobWithDocument(scope,{kind:'SALE_TICKET',id:'V'},{}),keys={preparedRequestKey:'P',downloadRequestKey:'D'}
 await api.requestPreparedDownload(scope,result.job.id,keys)
 assert.equal(calls.length,2);assert.match(calls[0].path,/includeDocument=true/);assert.match(calls[1].path,/J\/download-request$/)
 assert.match(calls[0].path,/includeLogo=true/)
 assert.deepEqual(calls[0].options.headers,{'X-Company-Id':'C','X-Branch-Id':'B'});assert.deepEqual(JSON.parse(calls[1].options.body),keys)
})

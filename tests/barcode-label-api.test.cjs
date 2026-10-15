const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {printInput}=require('./fixtures/barcodeLabelFixtures.cjs')
test('print preparation uses dedicated API, no generic stock or product update',async()=>{
  const calls=[],service=loadReportModule('../inventory/barcodeLabels/barcodeLabelService.ts',{'@/services/api':{apiFetch:async(path,options)=>{calls.push({path,body:JSON.parse(options.body),headers:options.headers});return{id:'prepared'}}}})
  await service.prepareBarcodeLabels(printInput())
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/products/barcode-labels/prepare');assert.equal(Object.hasOwn(calls[0].body,'companyId'),false)
  assert.equal(calls[0].headers?.['X-Branch-Id'],printInput().scope.branchId)
})
test('company layout save uses chosen authorized branch even from consolidated global selector',async()=>{
  const calls=[],service=loadReportModule('../inventory/barcodeLabels/barcodeLabelService.ts',{'@/services/api':{apiFetch:async(path,options)=>{calls.push({path,options});return{revision:1}}}}),input=printInput()
  await service.saveBarcodeLayout({expectedRevision:0,design:input.design,defaultPaper:input.paper},undefined,input.scope.branchId)
  assert.equal(calls[0].options.headers?.['X-Branch-Id'],input.scope.branchId);assert.equal(JSON.parse(calls[0].options.body).branchId,undefined)
})

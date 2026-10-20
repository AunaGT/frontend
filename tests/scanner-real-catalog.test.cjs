const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const scope={companyId:'A',branchId:'B',canViewProducts:true,inventoryEnabled:true}
function load(fetch){return loadReportModule('../../services/scannerService.ts',{'@/services/api':{apiFetch:fetch,getActiveCompanyId:()=> 'A',getActiveBranchId:()=>'B'}})}
test('real catalog lookup retains zeros and checks exact barcode across search pages',async()=>{
 const calls=[],{lookupScannedProduct}=load(async(path,options)=>{calls.push({path,options});return{items:calls.length===1?[{id:'partial',barcode:'001234'}]:[{id:'exact',barcode:'00123',name:'Real'}],page:calls.length,pageSize:100,totalPages:2,totalItems:2}})
 assert.equal((await lookupScannedProduct(scope,'00123')).id,'exact');assert.equal(calls.length,2);assert.match(calls[0].path,/search=00123/);assert.match(calls[0].path,/in_branch=1/);assert.deepEqual(calls[0].options.headers,{'X-Company-Id':'A','X-Branch-Id':'B'})
})
test('lookup distinguishes missing data, offline failure and lack of module or permission',async()=>{
 let count=0;const {lookupScannedProduct}=load(async()=>{count++;throw Error('offline')})
 for(const context of [{...scope,canViewProducts:false},{...scope,inventoryEnabled:false},{...scope,companyId:'C'},{...scope,branchId:'all'}])await assert.rejects(lookupScannedProduct(context,'00123'))
 assert.equal(count,0);await assert.rejects(lookupScannedProduct(scope,'00123'),/offline/)
 const missing=load(async()=>({items:[],page:1,pageSize:100,totalPages:1,totalItems:0}));assert.equal(await missing.lookupScannedProduct(scope,'00123'),null)
})

const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('package image upload carries scoped multipart and refuses a response after company switch',async()=>{
 let company='a',release,request
 const {uploadPackageImage}=loadReportModule('../inventory/packages/api.ts',{'@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=> 'b',apiFetch:async(path,options)=>{request={path,options};return new Promise(r=>release=r)}},'@/services/authSession':{authSessionIdentity:()=> 's',authSessionMatches:()=>true}})
 const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'},file=new File(['image'],'test.png',{type:'image/png'}),abort=new AbortController()
 const pending=uploadPackageImage(scope,file,abort.signal)
 assert.equal(request.path,'/api/commercial-packages/images');assert.ok(request.options.body instanceof FormData);assert.equal(request.options.body.get('image').name,'test.png');assert.equal(request.options.retryUnauthorized,false);assert.equal(request.options.signal,abort.signal);assert.equal(request.options.headers['X-Company-Id'],'a')
 company='other';release({imageUrl:'https://old.invalid/photo.webp'});await assert.rejects(pending,{name:'AbortError'})
})

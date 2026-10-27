const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
function transport(status=200){
 const calls=[],exports={},window={dispatchEvent(){},fetch:async(url,options)=>{calls.push({url,options});return new Response('{}',{status})}}
 const source=fs.readFileSync(path.join(__dirname,'../src/services/api.ts'),'utf8').replace('import.meta.env.VITE_API_URL',JSON.stringify('https://api.invalid/api'))
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,module:{exports},window,fetch:(...args)=>window.fetch(...args),localStorage:{getItem:k=>({'tenant:companyId':'a','tenant:branchId':'b'}[k]??null)},Headers,Request,URL,Event,FormData,console})
 return {calls,api:exports}
}
test('multipart transport preserves tenant and abort headers without forcing a JSON boundary or replay',async()=>{
 const f=transport(),body=new FormData(),abort=new AbortController();body.append('image',new Blob(['image']),'photo.png')
 await f.api.apiFetch('/upload',{method:'POST',body,signal:abort.signal,retryUnauthorized:false})
 const opts=f.calls[0].options,headers=new Headers(opts.headers);assert.equal(headers.has('content-type'),false);assert.equal(headers.get('X-Company-Id'),'a');assert.equal(opts.body,body);assert.equal(opts.signal,abort.signal)
 await f.api.apiFetch('/json',{method:'POST',body:'{}'});assert.equal(new Headers(f.calls[1].options.headers).get('content-type'),'application/json')
 const denied=transport(401);await assert.rejects(denied.api.apiFetch('/upload',{method:'POST',body,retryUnauthorized:false}));assert.equal(denied.calls.length,1)
})

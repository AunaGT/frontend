const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
function transport({changeDuringRefresh=false}={}){
 const calls=[],map=new Map([['tenant:companyId','a'],['tenant:branchId','b']]),window={dispatchEvent(){}}
 window.fetch=async(url,options)=>{calls.push({url,method:options?.method||'GET'});if(url.endsWith('/auth/refresh')){if(changeDuringRefresh)map.set('tenant:companyId','other');return new Response('{}',{status:200})}return calls.filter(c=>!c.url.endsWith('/auth/refresh')).length===1?new Response('{}',{status:401}):new Response('{"ok":true}',{status:200})}
 const exports={},source=fs.readFileSync(path.join(__dirname,'../src/services/api.ts'),'utf8').replace('import.meta.env.VITE_API_URL',JSON.stringify('https://api.invalid/api'))
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,module:{exports},window,fetch:(...args)=>window.fetch(...args),localStorage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},Headers,Request,URL,Event,console})
 return{api:exports,calls}
}
test('integration creation never refreshes or replays through either real transport retry layer',async()=>{
 for(const changeDuringRefresh of [false,true]){
  const f=transport({changeDuringRefresh}),{createKey}=loadReportModule('../config/integrations/api.ts',{'@/services/api':f.api,'@/services/authSession':{authSessionIdentity:()=> 's',authSessionMatches:()=>true}})
  await assert.rejects(()=>createKey({companyId:'a',branchId:'b',userId:'u',sessionId:'s'},{name:'Web',ownerId:'u',scopes:['products.read'],branchIds:['b'],days:90}))
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'POST')
 }
})
test('ordinary ERP requests retain their existing session refresh behavior',async()=>{
 const f=transport();assert.equal((await f.api.apiFetch('/ordinary')).ok,true);assert.equal(f.calls.length,3);assert.ok(f.calls[1].url.endsWith('/auth/refresh'))
})

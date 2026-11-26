const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'}
test('package requests use the selected target branch while guarding the active context snapshot',async()=>{
 let activeBranch='b',release,request
 const api=loadReportModule('../inventory/packages/api.ts',{
  '@/services/api':{getActiveCompanyId:()=> 'a',getActiveBranchId:()=>activeBranch,apiFetch:async(path,opts)=>{request={path,opts};return new Promise(r=>{release=r})}},
  '@/services/authSession':{authSessionIdentity:()=> 's',authSessionMatches:()=>true},
 })
 const target={...scope,branchId:'other',activeBranchId:'b'}
 const pending=api.fetchPackages(target)
 assert.equal(request.opts.headers['X-Branch-Id'],'other')
 release({items:[]});assert.deepEqual(await pending,{items:[]})
 const stale=api.fetchPackages(target);activeBranch='changed';release({items:[{id:'stale'}]})
 await assert.rejects(stale,{name:'AbortError'})
})
test('package API rejects a response after tenant switch instead of returning another tenant data',async()=>{
 let companyId='a',release,signal
 const api=loadReportModule('../inventory/packages/api.ts',{
  '@/services/api':{getActiveCompanyId:()=>companyId,getActiveBranchId:()=> 'b',apiFetch:async(path,opts)=>{signal=opts.signal;return new Promise(r=>{release=r})}},
  '@/services/authSession':{authSessionIdentity:()=> 's',authSessionMatches:()=>true},
 })
 const abort=new AbortController(),request=api.fetchPackages(scope,{},abort.signal)
 companyId='other';release({items:[{id:'private'}]})
 await assert.rejects(request,{name:'AbortError'});assert.equal(signal,abort.signal)
})
test('variant editor uses labeled system controls and progressive composition sections',()=>{
 const nodes=[],{PackageVariantFields}=loadReportModule('../inventory/packages/PackageVariantFields.tsx',{'./api':{}},nodes)
 const variant={id:'v',name:'Evento',price:'100.00',components:[],choices:[]}
 const html=renderToStaticMarkup(React.createElement(PackageVariantFields,{variant,index:0,scope,onChange(){},disabled:false}))
 assert.match(html,/Precio de esta opción/);assert.match(html,/Siempre incluye/);assert.match(html,/El cliente puede elegir/)
 assert.match(html,/auna-control/);assert.doesNotMatch(html,/Distribución del precio/,'No allocation controls before adding components')
 assert.doesNotMatch(html,/type="number"[^>]*style=/)
 assert.ok(nodes.some(n=>n.type?.displayName==='Input'))
})

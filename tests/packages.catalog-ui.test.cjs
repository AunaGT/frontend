const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'}
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
 assert.match(html,/Precio del paquete/);assert.match(html,/Productos y servicios fijos/);assert.match(html,/Elecciones del cliente/)
 assert.match(html,/auna-control/);assert.doesNotMatch(html,/Distribución del precio/,'No allocation controls before adding components')
 assert.doesNotMatch(html,/type="number"[^>]*style=/)
 assert.ok(nodes.some(n=>n.type?.displayName==='Input'))
})

const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('shared package choices display the agreed total without editable component prices',()=>{
 const {CommercialPackageSelection}=loadReportModule('../inventory/packages/CommercialPackagesEditor.tsx',{'@/modules/inventory/packages/api':{}})
 const html=renderToStaticMarkup(React.createElement(CommercialPackageSelection,{selection:{groupId:'g',packageId:'p',version:1,variantId:'v',choices:[]},definition:{name:'Celebración',currency:'GTQ',variants:[{id:'v',name:'80 shots',price:'1599.00',components:[],choices:[]}]},group:{groupId:'g',name:'Celebración',variantName:'80 shots',currency:'GTQ',state:'COMPLETE',amount:'1599.00',components:[],issues:[]},onChange(){},onRemove(){}}))
 assert.match(html,/Celebración/);assert.match(html,/80 shots/);assert.match(html,/1[,.]599/);assert.doesNotMatch(html,/<input[^>]*(price|precio)/)
})
test('sales purpose routes catalog and preview through the restricted sales API',async()=>{
 const calls=[],scope={companyId:'A',branchId:'B',userId:'U',sessionId:'S',purpose:'sale'}
 const api=loadReportModule('../inventory/packages/api.ts',{'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:async(path,options)=>{calls.push({path,options});return{items:[]}}},'@/services/authSession':{authSessionIdentity:()=> 'S',authSessionMatches:()=>true}})
 await api.fetchPackages(scope,{activeOnly:true});await api.fetchPackage(scope,'p');await api.previewPackages(scope,[])
 assert.match(calls[0].path,/^\/api\/sales\/packages\?/);assert.equal(calls[1].path,'/api/sales/packages/p');assert.equal(calls[2].path,'/api/sales/packages/preview')
 assert.notDeepEqual(api.packageQueryKey(scope),api.packageQueryKey({...scope,purpose:undefined}))
})

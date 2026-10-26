const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const selection={groupId:'group',packageId:'package',version:1,variantId:'variant',choices:[{choiceId:'flavors',items:[{optionId:'a',quantity:'80'},{optionId:'b',quantity:'80'}]}]}
const definition={name:'Fiesta',variants:[{id:'variant',name:'160 shots',price:'1599.00',components:[],choices:[{id:'flavors',name:'Sabores',totalQuantity:'160',maxDistinct:2,options:[{id:'a',productId:'lime'},{id:'b',productId:'berry'}]}]}]}
test('flavor progress is explicit, never fills quantities or sends a package price',()=>{
 const {packageProgress,packageSelectionsPayload,quotePackageSeed}=loadReportModule('../quotes/packageSelection.ts',{'@/modules/inventory/packages/api':{}})
 assert.equal(packageProgress(definition.variants[0].choices[0],selection.choices[0]).label,'160 de 160')
 const partial={...selection,choices:[{choiceId:'flavors',items:[{optionId:'a',quantity:'80'}]}]}
 assert.equal(packageProgress(definition.variants[0].choices[0],partial.choices[0]).remaining,'80')
 assert.deepEqual(packageSelectionsPayload([selection]),[selection])
 const seed=quotePackageSeed({lines:[{product_id:'free'},{product_id:'lime',package_component_key:'group:a'}],packageGroups:[{selection:partial,state:'INCOMPLETE',amount:null,estimatedAmount:'1599.00'}]})
 assert.deepEqual(seed.selections,[partial]);assert.equal(seed.freeItems.length,1);assert.equal(seed.incomplete,true)
})
test('quotation package sections expose incomplete status and included components as non-editable totals',()=>{
 const nodes=[],{QuotePackageSelection}=loadReportModule('../quotes/components/QuotePackagesEditor.tsx',{'@/modules/inventory/packages/api':{}},nodes)
 const html=renderToStaticMarkup(React.createElement(QuotePackageSelection,{selection,definition,products:{lime:'Limón',berry:'Frutos rojos'},onChange(){},onRemove(){},disabled:false,
  group:{name:'Fiesta',variantName:'160 shots',state:'INCOMPLETE',estimatedAmount:'1599.00',amount:null,issues:[{message:'Falta completar la selección',remainingQuantity:'80'}],components:[]}}))
 assert.match(html,/160 de 160/);assert.match(html,/Falta completar la selección/);assert.match(html,/Total pendiente de completar/)
 assert.ok(nodes.some(n=>n.props['aria-label']==='Cantidad de Limón'))
 assert.ok(!nodes.some(n=>n.props['aria-label']?.startsWith('Precio de')))
})
test('updating quotation includes revision, package selections and abort signal without expanded components',async()=>{
 let request
 const api=loadReportModule('../../services/quoteService.ts',{'./api':{apiFetch:async(path,options)=>{request={path,options};return{id:'q'}}}})
 const signal=new AbortController().signal
 await api.updateQuote('q',{items:[],packages:[selection],expectedRevision:'revision'},{signal})
 assert.equal(request.options.signal,signal);assert.equal(request.options.method,'PUT')
 assert.deepEqual(JSON.parse(request.options.body),{items:[],packages:[selection],expectedRevision:'revision'})
})
test('reopening an incomplete package preserves selection and blocks send while allowing draft save',async()=>{
 const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],writes=[],dirty=[]
 const partial={...selection,choices:[{choiceId:'flavors',items:[{optionId:'a',quantity:'80'}]}]},group={groupId:'group',name:'Fiesta',variantName:'160 shots',currency:'GTQ',selection:partial,state:'INCOMPLETE',estimatedAmount:'1599.00',amount:null,netAmount:null,components:[],issues:[{message:'Falta completar la selección',remainingQuantity:'80'}]}
 const quote={id:'q',status:'DRAFT',branch_id:'b',integration_revision:'revision',lines:[],packageGroups:[group],customer:'Cliente',is_final_consumer:true}
 const Page=loadReportModule('../quotes/QuoteEditor.tsx',{
  react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@tanstack/react-query':{useQuery:()=>({})},
  '@/context/useTenant':{useTenant:()=>({company:{id:'a'},branch:{id:'b'},branches:[],registerTenantExitGuard:()=>()=>{}})},
  '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'u'},hasPermission:()=>true})},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},
  '@/services/authSession':{authSessionIdentity:()=> 's'},'@/services/api':{},'./api':{},
  '@/modules/sales':{SavedCustomerMany2One:()=>null},'@/modules/appointments/components/DraftGuard':{useDraftGuard:value=>{dirty.push(value);return{dialog:null,proceed:fn=>fn(),request:fn=>fn()}}},
  '@/services/productService':{postPricingPreview:async()=>({unit_prices:{},price_tier_used:'WHOLESALE'})},
  '@/services/quoteService':{previewQuoteServiceConditions:async()=>({conditions:{}}),updateQuote:async(id,payload)=>{writes.push(payload);return quote}},
 },nodes).default
 const render=()=>{nodes.length=0;return h.render(()=>Page({mode:'edit',initialQuote:quote}))}
 try{
  render();assert.equal(dirty.at(-1),false,'opening a saved draft is not an unsaved edit');const send=nodes.find(n=>n.props.title==='Completa las cantidades de los paquetes antes de enviar');assert.equal(send.props.disabled,true)
  const save=nodes.find(n=>n.props.children?.includes?.('Guardar borrador'));assert.equal(save.props.disabled,false)
  await save.props.onClick();assert.deepEqual(writes[0].packages,[partial]);assert.deepEqual(writes[0].items,[]);assert.equal(writes[0].expectedRevision,'revision')
 }finally{h.unmount()}
})

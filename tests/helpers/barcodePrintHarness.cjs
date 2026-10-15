const {loadReportModule}=require('./loadReportModule.cjs'),{hookHarness}=require('./reportHookHarness.cjs'),{labelProduct}=require('../fixtures/barcodeLabelFixtures.cjs')
const BRANCH='33333333-3333-4333-8333-333333333333',OTHER='44444444-4444-4444-8444-444444444444'
function mountBarcodePrintPage({allowed=true,branch=true,filters={},pdf=null,missing=false,purpose='barcode'}={}){
  const h=hookHarness(),nodes=[],calls=[],{createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts')
  const product=labelProduct(missing?{barcode:null}:{}),selected=new Map([[product.id,{product,copies:2,assignment:{mode:purpose!=='shelf'&&missing?'auto':'keep'}}]])
  if(purpose==='shelf')product.shelfPrices=[{tier:'LIST',label:'Normal',amount:'10.00'}]
  const flow={selected,design:createLabelTemplate(),paper:defaultPaper(),layout:{revision:1,capabilities:{canAssign:allowed,canSaveLayout:allowed}},loading:false,busy:false,error:'',pdf,prepared:{products:[product]},progress:{donePages:0,totalPages:0},prepare:async confirmed=>{calls.push({action:'prepare',confirmed});return !!pdf},setDesign:d=>calls.push({action:'design',d}),setPaper(){},selectProduct(){},removeProduct(){},setCopies(){},setAssignment(){},saveLayout:async()=>{},reloadLayout:async()=>{},refreshSelected:async()=>{},downloadLabels(){calls.push({action:'download',blob:pdf?.labels})}}
  let scoped
  const Page=loadReportModule('../inventory/barcodeLabels/BarcodePrintPage.tsx',{
    react:h.hooks,'@/services/api':{apiFetch(){throw Error('Unexpected page API request')}},'react-router-dom':{useNavigate:()=>()=>{},useLocation:()=>({state:{companyId:'company',selectedIds:[product.id],filters}})},
    '@/context/useTenant':{useTenant:()=>({company:{id:'company',name:'QA'},branch:branch?{id:BRANCH,name:'Principal'}:null,branches:[{id:BRANCH,name:'Principal'},{id:OTHER,name:'Otra'}],setBranch(){}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'user'},hasPermission:()=>allowed})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({companyName:'QA',locale:'es-GT',currencyCode:'GTQ'})},
    '@/components/layout/PageNavigation':{usePageTrail(){}},'@/modules/promotions/coupons/couponFonts':{createCouponMeasure:async()=>(t,s)=>t.length*s.fontSize*.5},
    './useBarcodePrint':{useBarcodePrint:options=>{scoped=options;return flow}},
  },nodes).default
  if(purpose==='shelf')flow.design=loadReportModule('../inventory/barcodeLabels/labelDesign.ts').createShelfLabelTemplate('price')
  const render=()=>{nodes.length=0;return h.render(()=>Page({purpose}))};render()
  return{nodes,calls,flow,get scope(){return scoped},render,unmount:h.unmount,ready:async()=>{await new Promise(r=>setImmediate(r));render()},tab:value=>{nodes.find(n=>n.props.ariaLabel==='Pasos de impresión de etiquetas').props.onValueChange(value);render()},BRANCH,OTHER}
}
module.exports={mountBarcodePrintPage,BRANCH,OTHER}

const{hookHarness}=require('./reportHookHarness.cjs'),{loadReportModule}=require('./loadReportModule.cjs')
function mountCouponForm({mode='edit',companyId='11111111-1111-4111-8111-111111111111',promotionId='44444444-4444-4444-8444-444444444444',initialDesign=null,pathname}={}){
  const h=hookHarness(),nodes=[],requests=[];let fail=false,result,scope={companyId,promotionId,pathname:pathname??(mode==='create'?'/promociones/nueva':`/promociones/${promotionId}/editar`)}
  const promotion={id:promotionId,coupon_design:initialDesign,name:'QA',active:true,type_id:1,type:{id:1,name:'PERCENTAGE'},discount_percentage:15,applies_to_all:true,start_date:'2026-10-12',codes:[{code:'REAL',active:true,current_uses:0}]}
  const page=loadReportModule(`../promotions/pages/Promotion${mode==='create'?'Create':'Edit'}Page.tsx`,{
    react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{},useParams:()=>({id:scope.promotionId}),useLocation:()=>({pathname:scope.pathname,state:null})},
    '@/context/useTenant':{useTenant:()=>({company:{id:scope.companyId},branches:[]})},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({companyName:'Empresa QA',currencyCode:'GTQ',locale:'es-GT',timezone:'America/Guatemala'})},
    '@/services/api':{apiFetch:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});if(fail)throw Error('QA fallo');return promotion}},
    './api':{},
    '../services/api':{},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}}),useQuery:({queryKey})=>({data:queryKey[0]==='promotion'?promotion:queryKey[0]==='promotion-types'?[promotion.type]:[],isLoading:false,isFetching:false}),useMutation:options=>({isPending:false,mutate:async body=>{try{const response=await options.mutationFn(body);options.onSuccess?.(response)}catch(e){options.onError?.(e)}}})},
    '../coupons/couponAssetsApi':{resolveCouponAssets:async()=>[],removeDraftCouponAsset:async()=>{},uploadCouponAsset:async()=>{throw Error('Unexpected')}}
  },nodes).default
  const render=()=>{nodes.length=0;result=h.render(()=>page());return result}
  render();render();render()
  const preview=()=>nodes.find(n=>n.type?.name==='PromotionPreview').props
  return{requests,render,nodes,preview,currentDesign:()=>preview().coupon.design,editDesign:value=>{preview().coupon.setDesign(value);render()},submit:async()=>{nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));render()},setFailure:value=>fail=value,switchScope:(companyId,promotionId)=>{scope={...scope,companyId,promotionId};render();render()},unmount:h.unmount}
}
module.exports={mountCouponForm}

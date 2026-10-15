const{test}=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const{hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('actual codes dialog cannot export old promotion using a new company branding',async()=>{
  const h=hookHarness(),nodes=[],downloads=[];let companyId='A',dialog={open:true,companyId:'A',promotion:{id:'P',name:'Old promotion A',company_id:'A',type:{name:'PERCENTAGE'},discount_percentage:15,codes:[{id:1,code:'CODE-A',active:true,current_uses:0}]}}
  const{CodesDialog}=loadReportModule('../promotions/pages/PromotionsManagement.tsx',{
    react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/context/useTenant':{useTenant:()=>({company:{id:companyId}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/services/api':{},'./api':{},'../services/api':{},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined},
    './generatePromotionTicketsPDF':{generatePromotionTicketsPDF:async options=>downloads.push(options)},
    '../coupons/couponAssetsApi':{resolveCouponAssets:async()=>[]}
  },nodes)
  const render=brand=>{nodes.length=0;h.render(()=>CodesDialog({dialog,setDialog:value=>dialog=value,onCopyCode(){},companyName:brand}))}
  render('Brand A');render('Brand A');companyId='B';render('Brand B');render('Brand B')
  const button=nodes.find(n=>React.Children.toArray(n.props.children).some(c=>typeof c==='string'&&c.startsWith('Descargar PDF')))
  await button.props.onClick()
  assert.equal(downloads.length,0)
  h.unmount()
})
test('actual list discards a late code-detail response when company changes',async()=>{
  const h=hookHarness(),nodes=[];let companyId='A',finish
  const promo={id:'P',company_id:'A',name:'QA',start_date:'2026-10-12',type:{name:'PERCENTAGE'},codes:[{code:'QA',active:true,current_uses:0}],active:true}
  const Page=loadReportModule('../promotions/pages/PromotionsListPage.tsx',{
    react:{...h.hooks,useDeferredValue:value=>value},'react-router-dom':{useNavigate:()=>()=>{}},
    '@/context/useTenant':{useTenant:()=>({company:{id:companyId},branch:{id:'branch'}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>false})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({companyName:companyId,locale:'es-GT'})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/services/api':{apiFetch:()=>new Promise(r=>finish=r)},'./api':{},'../services/api':{},
    '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}}),useMutation:()=>({isPending:false}),useQuery:({queryKey})=>({isLoading:false,data:queryKey[0]==='promotions'?{items:[promo],totalPages:1,page:1,totalItems:1,pageSize:10}:[]})}
  },nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())}
  render()
  const action=nodes.find(n=>n.props.onSelect&&React.Children.toArray(n.props.children).some(c=>typeof c==='string'&&c==='Ver códigos y PDF'))
  const pending=action.props.onSelect();companyId='B';render();finish(promo);await pending;render()
  assert.equal(nodes.find(n=>n.type?.name==='CodesDialog').props.dialog.open,false)
  h.unmount()
})

test('a single code with unlimited uses asks how many copies and whether to print the code',async()=>{
  const h=hookHarness(),nodes=[],downloads=[]
  const code={id:1,code:'TODOS-15',active:true,current_uses:0}
  let dialog={open:true,companyId:'A',promotion:{id:'P',name:'Para todos',company_id:'A',type:{name:'PERCENTAGE'},discount_percentage:15,codes:[code]}}
  const{CodesDialog}=loadReportModule('../promotions/pages/PromotionsManagement.tsx',{
    react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/context/useTenant':{useTenant:()=>({company:{id:'A'}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/services/api':{},'./api':{},'../services/api':{},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined},
    './generatePromotionTicketsPDF':{generatePromotionTicketsPDF:async options=>downloads.push(options)},
    '../coupons/couponAssetsApi':{resolveCouponAssets:async()=>[]}
  },nodes)
  const render=()=>{nodes.length=0;h.render(()=>CodesDialog({dialog,setDialog:value=>dialog=value,onCopyCode(){},companyName:'A'}))}
  const find=label=>nodes.find(n=>n.props?.['aria-label']===label)
  const download=()=>nodes.find(n=>React.Children.toArray(n.props.children).some(c=>typeof c==='string'&&c.startsWith('Descargar PDF')))
  render();render()
  assert.equal(find('Copias en el PDF').props.value,4,'a full sheet by default')
  find('Copias en el PDF').props.onChange({target:{value:'6'}});render()
  find('Imprimir el código en el cupón').props.onCheckedChange(false);render()
  await download().props.onClick()
  assert.equal(downloads[0].codes.length,6);assert.ok(downloads[0].codes.every(c=>c.code==='TODOS-15'));assert.equal(downloads[0].printCode,false)
  find('Copias en el PDF').props.onChange({target:{value:'0'}});render()
  assert.equal(download().props.disabled,true,'copies must be between 1 and 200')
  dialog={...dialog,promotion:{...dialog.promotion,id:'Q',max_uses:20}};render();render()
  assert.equal(find('Copias en el PDF'),undefined,'limited uses keep one coupon per code')
  h.unmount()
})

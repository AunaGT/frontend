const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('consolidated payroll detail loads with all-branch read scope but exposes no mutation controls',async()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),queries=[],requests=[]
  const run={id:'R',status:'BORRADOR',name:'QA',code:'QA',type:'ORDINARIA',period_start:'2026-10-01',period_end:'2026-10-31',pay_date:'2026-10-31',payslips:[],total_earnings:0,total_deductions:0,total_net:0,total_employer_cost:0}
  const Page=loadReportModule('../payroll/pages/PayrollRunDetail.tsx',{
    '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:null,isConsolidated:true})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},hasPermission:()=>true})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({companyName:'A'})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'all',apiFetch:async(url,options)=>{requests.push([url,options]);return run}},
    '@tanstack/react-query':{useQuery:o=>{queries.push(o);return{data:run,isLoading:false,isError:false}},useMutation:()=>({isPending:false}),useQueryClient:()=>({invalidateQueries(){}})},
    'react-router-dom':{...require('react-router-dom'),useParams:()=>({id:'R'})},
  }).default
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page)))
  assert.equal(queries[0].enabled,true);await queries[0].queryFn();assert.equal(requests[0][1].headers['X-Branch-Id'],'all')
  assert.doesNotMatch(html,/>Recalcular<|Confirmar nómina|Marcar pagada|>Anular<|Revisar parámetros disponibles/)
  assert.match(html,/Empleados/)
})
test('selected configuration label meets normal-text contrast on its light orange tint',async()=>{
  const fs=require('node:fs'),postcss=require('postcss'),path=require('node:path'),{root}=await postcss().process(fs.readFileSync(path.join(__dirname,'../src/modules/config/pages/config.css'),'utf8'),{from:undefined})
  let color;root.walkRules(rule=>{if(rule.selector==='.config-nav-group button[aria-current="page"]')rule.walkDecls('color',d=>color=d.value)})
  const hsl=color==='hsl(var(--foreground))'?[220,62,18]:[24,94,53]
  function rgb([h,s,l]){s/=100;l/=100;const a=s*Math.min(l,1-l);return[0,8,4].map(n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))})}
  function lum(a){return a.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
  const text=lum(rgb(hsl)),background=lum(rgb([24,94,53]).map(v=>.12*v+.88)),ratio=(Math.max(text,background)+.05)/(Math.min(text,background)+.05)
  assert.ok(ratio>=4.5,`Selected label contrast ${ratio.toFixed(2)}:1`)
})
test('disabling a domain module cannot reuse the previously cached domain history page',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),keys=[];let enabled=new Set(['inventory','accounting'])
  const History=loadReportModule('../config/components/SettingsHistorySection.tsx',{
    '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissionsReady:true,hasPermission:()=>true})},
    '@/context/useModules':{useModules:()=>({enabledModuleCodes:enabled,isLoading:false,isError:false})},'@/services/settingsService':{},
    '@tanstack/react-query':{useQuery:o=>{keys.push(o.queryKey);return{data:{items:[],totalItems:0,totalPages:1}}}},
  }).SettingsHistorySection
  renderToStaticMarkup(React.createElement(History));enabled=new Set();renderToStaticMarkup(React.createElement(History))
  assert.notDeepEqual(keys[0],keys[1])
})

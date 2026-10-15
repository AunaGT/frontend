const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const {loadReportModule}=require('./loadReportModule.cjs'),{hookHarness}=require('./reportHookHarness.cjs')
function renderAppointmentPage({api,slots,scope={companyId:'A',branchId:'B'}}={}){
  const h=hookHarness(),nodes=[],writes=[],navigations=[]
  const available=slots||[{startsAt:'2030-01-01T15:00:00.000Z',endsAt:'2030-01-01T15:45:00.000Z',timezone:'America/Guatemala',providerIds:['professional'],resourceIds:[],sessionId:null,remaining:1}]
  const directory={branches:[],providers:[],resources:[],employeeCandidates:[]}
  const fakeApi={appointmentQueryKey:(s,k,p)=>['appointments',s.companyId,s.branchId,k,p],getAgenda:async()=>directory,mutateAgenda:async(path,s,body)=>{if(path==='/availability')return available;writes.push({path,body});return api(path,body)}}
  const Page=loadReportModule('../appointments/pages/AppointmentCreatePage.tsx',{
    react:h.hooks,'react-router-dom':{...require('react-router-dom'),useSearchParams:()=>[new URLSearchParams(),()=>{}],useNavigate:()=>url=>navigations.push(url)},
    '@/components/layout/PageNavigation':{usePageTrail(){}},
    '../useAgendaContext':{useAgendaContext:()=>({scope,ready:true,writable:true,timezone:'America/Guatemala',hasPermission:()=>true})},
    '../useServiceScheduleDraft':{emptyDirectory:directory},'../components/DraftGuard':{useDraftGuard:()=>({request:fn=>fn(),proceed:fn=>fn(),dialog:null})},
    '../api':fakeApi,'./api':fakeApi,
    '@tanstack/react-query':{useQuery:options=>({data:options.queryKey[3]==='availability'?available:directory,isLoading:false,isError:false,refetch(){}}),useQueryClient:()=>({invalidateQueries(){}})},
  },nodes).CreateWorkspace
  const rerender=()=>{nodes.length=0;const tree=h.render(()=>Page({}));const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,tree));return {html,nodes}}
  return {rerender,writes,navigations}
}
module.exports={renderAppointmentPage}

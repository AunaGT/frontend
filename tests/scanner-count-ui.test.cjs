const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('scan reveals an off-page count row without saving, and successful saves refresh its baseline',async()=>{
 const h=hookHarness(),nodes=[],writes=[];let qty='5'
 const row=()=>({id:'L',session_id:'S',product_id:'P',qty_counted:qty,product:{name:'Agua'},location:{code:'A'},difference:'0'})
 const oldDocument=global.document;global.document={getElementById:()=>({focus(){},scrollIntoView(){}})}
 const Page=loadReportModule('../inventory-count/pages/InventoryCountSessionPage.tsx',{
  react:h.hooks,'react-router-dom':{useParams:()=>({sessionId:'S'}),useNavigate:()=>()=>{}},
  '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/context/useAuth':{useAuth:()=>({user:{id:'U'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({pageSize:10,setPageSize(){}})},
  '@/components/shared/ScannerField':{ScannerField:()=>null},'@/services/api':{apiFetch(){throw Error('Unexpected request')}},'./api':{apiFetch(){throw Error('Unexpected request')}},
  '../api/inventoryCountService':{findCountScan:async()=>[{lineId:'L',name:'Agua',location:'A'}],readScannedCountLine:async()=>({data:[row()]}),updateInventoryLine:async(id,line,body)=>{writes.push(body);qty=String(body.qty_counted);return row()}},
  '@tanstack/react-query':{useQuery:({queryKey})=>({data:queryKey[0]==='inventory-session'?{id:'S',status:'IN_PROGRESS',scope_json:{},createdBy:{name:'QA'},created_at:'2026-10-22'}:queryKey[0]==='inventory-lines'?{data:[],total:0}:[],isLoading:false}),useMutation:()=>({}),useQueryClient:()=>({invalidateQueries(){}})},
 },nodes).default
 const render=()=>{nodes.length=0;h.render(()=>Page())}
 try{render();await nodes.find(n=>n.type.name==='ScannerField').props.onScan('001',new AbortController().signal);render();assert.equal(writes.length,0)
  let line=nodes.find(n=>n.type.name==='LineRow');assert.equal(line.props.row.qty_counted,'5');await line.props.onSavePrimary('8');render()
  line=nodes.find(n=>n.type.name==='LineRow');assert.equal(line.props.row.qty_counted,'8');await line.props.onSavePrimary('5');render();assert.equal(writes.length,2);assert.equal(nodes.find(n=>n.type.name==='LineRow').props.row.qty_counted,'5')
 }finally{h.unmount();global.document=oldDocument}
})

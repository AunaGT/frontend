const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('advance list requests fifty records but embedded employee history keeps ten',async()=>{
  for(const [employeeId,expected] of [[undefined,50],['qa-employee',10]]) {
    const queries=[],requests=[]
    const {AdvancesManagement}=loadReportModule('../hr/pages/AdvancesManagement.tsx',{
      '@/hooks/use-toast':{useToast:()=>({toast(){}})},
      '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>false})},
      '@/services/hrService':{ADVANCE_STATUS_LABELS:{},fetchAdvances:async p=>requests.push(p)},
      '@tanstack/react-query':{useQueryClient:()=>({}),useMutation:()=>({}),useQuery:options=>{queries.push(options);return {data:{items:[],totalItems:0,totalPages:1},isLoading:false}}},
    })
    renderToStaticMarkup(React.createElement(AdvancesManagement,{employeeId}))
    await queries.find(q=>q.queryKey[0]==='hr-advances').queryFn()
    assert.equal(requests[0].pageSize,expected)
    assert.equal(requests[0].employee_id,employeeId)
  }
})

const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('only the canonical global admin bypasses permissions, never a legacy name or company role',()=>{
 for(const [role,expected] of [
  [{name:'Admin'},false],
  [{name:'admin',system_key:'ADMIN',company_id:'tenant'},false],
  [{name:'admin',system_key:'ADMIN',company_id:null},true],
 ]){
  const {useAuthPermissions}=loadReportModule('../../hooks/useAuthPermissions.ts',{
   react:{useMemo:fn=>fn()},'@/context/useAuth':{useAuth:()=>({user:{role,permissions:['products.view']},isLoading:false})},
  })
  const auth=useAuthPermissions();assert.equal(auth.hasPermission('returns.complete'),expected)
  assert.equal(auth.hasPermission('products.view'),true)
 }
})
test('a stored consolidated view is discarded for a legacy admin name without global read permission',()=>{
 const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),writes=[]
 const user={role:{name:'Admin'},companies:[{id:'A'}],branches:[{id:'B',company_id:'A',is_default:true}],permissions:[]}
 const {TenantProvider}=loadReportModule('../../context/TenantProvider.tsx',{
  react:h.hooks,'./useAuth':{useAuth:()=>({user})},'@tanstack/react-query':{useQueryClient:()=>({clear(){}})},
  '@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'all',setActiveTenant:(...args)=>writes.push(args)},
 })
 h.render(()=>TenantProvider({children:null}))
 assert.deepEqual(writes,[['A','B']])
 const value=h.render(()=>TenantProvider({children:null})).props.value
 assert.equal(value.isConsolidated,false);assert.equal(value.branch.id,'B')
})

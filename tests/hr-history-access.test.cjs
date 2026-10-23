const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
for(const summary of [false,true])test((summary?'overview count':'deduction history')+' discards cached and late data after permission/context changes',async()=>{
 const h=hookHarness(),nodes=[];let allowed=true,company='A',cached,request
 const module=loadReportModule(summary?'../hr/pages/EmployeeSummary.tsx':'../hr/pages/EmployeeHistory.tsx',{
  react:h.hooks,
  '@/context/useTenant':{useTenant:()=>({company:{id:company},branch:{id:'B'}})},
  '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissions:allowed?['hr.employees.view','hr.deductions.view']:['hr.employees.view'],hasPermission:code=>code!=='hr.deductions.view'||allowed})},
  '@/services/hrService':{fetchEmployeeHistory:async(_id,_page,options)=>{if(options)assert.ok(options.signal);return{items:[{id:'H',event:'DEDUCTION_CREATED',created_at:'2026-10-20',actor:{name:'Ana'}}],totalItems:99,page:1,totalPages:10}},fetchEmployeeOverview:async(_id,options)=>{if(options)assert.ok(options.signal);return{history:{count:99}}},PAYMENT_METHOD_LABELS:{}},
  './EmployeeRecentActivity':{EmployeeRecentActivity:()=>null},
  '@tanstack/react-query':{useQuery:options=>{request ||= options.queryFn;return{data:cached,isPending:false,isFetching:false,isError:false}}},
 },nodes)
 const employee={id:'E',first_name:'Ana',last_name:'Gómez',hire_date:'2020-01-01',base_salary:'3000',bonificacion_incentivo:'250'}
 const render=()=>{nodes.length=0;h.render(()=>summary?module.EmployeeSummary({employee}):module.EmployeeHistory({employeeId:'E'}))}
 render();cached=await request({signal:new AbortController().signal});render()
 assert.ok(nodes.some(n=>summary?n.props.children===99:n.props.children==='Descuento registrado'))
 allowed=false;render()
 assert.equal(nodes.some(n=>n.props.children===99||n.props.children==='Descuento registrado'),false)
 // A delayed response from the old authorization remains unusable even if its query cache updates.
 cached=await request({signal:new AbortController().signal});render()
 assert.equal(nodes.some(n=>n.props.children===99||n.props.children==='Descuento registrado'),false)
 company='OTHER';render();assert.equal(nodes.some(n=>n.props.children===99||n.props.children==='Descuento registrado'),false)
 h.unmount()
})

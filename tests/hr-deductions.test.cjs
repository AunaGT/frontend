const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')
const EMP='11111111-1111-4111-8111-111111111111'
function setup(t,{manage=true}={}) {
  const h=hookHarness(),nodes=[],jobs=[],requests=[],messages=[];let company='A'
  const module=loadReportModule('../hr/pages/DeductionsManagement.tsx',{
    react:h.hooks,
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},hasPermission:()=>true})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},
    '@/hooks/use-toast':{useToast:()=>({toast:m=>messages.push(m)})},
    '@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=> 'B'},
    '@/services/hrService':{fetchDeductions:async()=>({items:[]}),fetchDeductionTargets:async()=>({items:[]}),fetchEmployeeDirectory:async()=>({items:[]}),createDeduction:async(...args)=>{requests.push(args);return{id:'D'}}},
    '@tanstack/react-query':{useQuery:()=>({data:{items:[],page:1,totalPages:1,totalItems:0},isPending:false,isFetching:false}),useQueryClient:()=>({invalidateQueries(){}}),useMutation:options=>({isPending:false,mutate:value=>{const job=Promise.resolve().then(()=>options.mutationFn(value)).then(result=>options.onSuccess?.(result,value)).catch(error=>options.onError?.(error,value));jobs.push(job)}})},
  },nodes)
  const render=()=>{nodes.length=0;return h.render(()=>module.DeductionsWorkspace({scope:{companyId:'A',branchId:'B'},canManage:manage,employeeId:EMP,employeeName:'Ana Gómez'}))}
  render();t.after(()=>h.unmount())
  return {nodes,jobs,requests,messages,render,company:value=>company=value,unmount:()=>h.unmount()}
}
test('new deduction starts from employee profile and sends exact money and mandatory reason',async t=>{
  const app=setup(t)
  app.nodes.find(n=>n.props.children==='Nuevo descuento').props.onClick();app.render()
  app.nodes.find(n=>n.props.id==='deduction-amount').props.onChange({target:{value:'125.50'}})
  app.nodes.find(n=>n.props.id==='deduction-reason').props.onChange({target:{value:'Acuerdo del empleado'}});app.render()
  app.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await Promise.all(app.jobs)
  assert.equal(app.requests.length,1)
  assert.deepEqual(app.requests[0][0],{employee_id:EMP,amount:'125.50',reason:'Acuerdo del empleado',target_run_id:null})
  assert.deepEqual(app.requests[0][1],{companyId:'A',branchId:'B'})
})
test('Nuevo opens the shared modal and closing it returns to the unchanged list',t=>{
  const app=setup(t)
  app.nodes.find(n=>n.props.children==='Nuevo descuento').props.onClick();app.render()
  const modal=app.nodes.find(n=>n.props.open===true&&typeof n.props.onOpenChange==='function')
  assert.ok(modal,'The creation form must open in a controlled dialog')
  assert.ok(app.nodes.some(n=>n.type==='form'))
  modal.props.onOpenChange(false);app.render()
  assert.equal(app.nodes.some(n=>n.type==='form'),false)
  assert.ok(app.nodes.some(n=>n.props.children==='Nuevo descuento'))
})
test('blank reasons are rejected without sending a deduction',async t=>{
  const app=setup(t);app.nodes.find(n=>n.props.children==='Nuevo descuento').props.onClick();app.render()
  app.nodes.find(n=>n.props.id==='deduction-amount').props.onChange({target:{value:'20'}});app.render()
  app.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await Promise.all(app.jobs);app.render()
  assert.equal(app.requests.length,0);assert.ok(app.nodes.some(n=>n.props.role==='alert'))
})
test('readonly payroll deductions do not expose management actions',t=>{
  const app=setup(t,{manage:false})
  assert.equal(app.nodes.some(n=>n.props.children==='Nuevo descuento'),false)
})
test('an old form cannot submit to a different active company',async t=>{
  const app=setup(t);app.nodes.find(n=>n.props.children==='Nuevo descuento').props.onClick();app.render()
  app.nodes.find(n=>n.props.id==='deduction-amount').props.onChange({target:{value:'20'}})
  app.nodes.find(n=>n.props.id==='deduction-reason').props.onChange({target:{value:'Motivo'}});app.render()
  const form=app.nodes.find(n=>n.type==='form');app.company('OTHER');form.props.onSubmit({preventDefault(){}});await Promise.all(app.jobs)
  assert.equal(app.requests.length,0)
})
test('deductions API always sends explicit tenant and string amounts',async()=>{
  const requests=[]
  const api=loadReportModule('../../services/hrService.ts',{'./api':{apiFetch:async(...args)=>{requests.push(args);return{items:[]}}}})
  await api.createDeduction({employee_id:EMP,amount:'1.01',reason:'Motivo',target_run_id:null},{companyId:'A',branchId:'B'})
  assert.equal(requests[0][1].headers['X-Company-Id'],'A');assert.equal(JSON.parse(requests[0][1].body).amount,'1.01')
})

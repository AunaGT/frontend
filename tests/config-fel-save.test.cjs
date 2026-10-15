const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('saving fiscal activation persists the switch and the existing issuer fields together',async()=>{
  const h=hookHarness(),nodes=[],writes=[]
  const Page=loadReportModule('../config/pages/ConfigManagement.tsx',{
    react:h.hooks,'@/components/layout/PageNavigation':{usePageTrail(){}},
    '@/context/useTenant':{useTenant:()=>({company:{id:'company-a'}})},
    '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/hooks/useSystemSettings':{useSystemSettings:()=>({refetch(){}})},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},
    '@/services/settingsService':{getSettings:async()=>({company_nit:'QA-123',company_address:'Dirección QA',fel_enabled:'false'}),updateSettings:async p=>{writes.push(p)}},
    './ModulesSettings':{ModulesSettings:()=>null},'./HrDocumentsSettings':{HrDocumentsSettings:()=>null},
  },nodes).default
  const render=()=>{nodes.length=0;h.render(()=>Page())}
  render();await new Promise(r=>setImmediate(r));render()
  nodes.find(n=>n.props.id==='fel_enabled').props.onCheckedChange(true);render()
  await nodes.find(n=>React.Children.toArray(n.props.children).some(c=>typeof c==='string'&&c.includes('Guardar datos fiscales'))).props.onClick()
  assert.equal(writes.length,1);assert.equal(writes[0].fel_enabled,'true');assert.equal(writes[0].company_nit,'QA-123');assert.equal(writes[0].company_address,'Dirección QA')
})

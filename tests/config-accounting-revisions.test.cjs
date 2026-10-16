const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{flush,deferred}=require('./helpers/configHarness.cjs')
test('accounting settings send loaded revisions and scope; obsolete company callbacks cannot save',async()=>{
  const h=hookHarness(),nodes=[],calls=[],pending=deferred();let companyId='A'
  const Page=loadReportModule('../accounting/components/SettingsTab.tsx',{
    react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:companyId},branch:{id:'B'+companyId}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
    '@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/services/api':{apiFetch(){throw Error('No red real')}},
    '@/services/accountingService':{getAccountingConfig:async()=>({defaults:{cash:'1101'},keys:['cash'],revision:3}),updateAccountingConfig:async(...args)=>{calls.push(args);return pending.promise},getPeriods:async()=>({items:[]})},
    '@/services/settingsService':{getSettings:async()=>({_revisions:{vat_affiliation:5,iva_rate:6,pequeno_rate:7}})},
  },nodes).SettingsTab
  const render=()=>{nodes.length=0;h.render(()=>Page({accounts:[],canManage:true}))}
  const save=()=>nodes.find(n=>React.Children.toArray(n.props.children).includes('Guardar configuración')).props.onClick
  try{
    render();await flush();render();const old=save(),saving=old()
    assert.deepEqual(calls[0],[{cash:'1101'},3,{companyId:'A',branchId:'BA'}])
    companyId='B';render();await flush();render();companyId='A';render();await flush();render()
    pending.resolve({revision:4});await saving;await old();assert.equal(calls.length,1)
  }finally{h.unmount()}
})

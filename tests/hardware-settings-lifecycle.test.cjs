const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{deferred,flush}=require('./helpers/configHarness.cjs')
test('related operation gate accepts hardware permission without granting other settings',()=>{
 const h=hookHarness();let companyId='A';const previous=global.window;global.window={addEventListener(){},removeEventListener(){}}
 const {useRelatedSettingsEditor}=loadReportModule('../config/useRelatedSettingsEditor.ts',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:companyId},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissionsReady:true,hasPermission:code=>code==='hardware.manage'})},'@/services/api':{getActiveCompanyId:()=>companyId,getActiveBranchId:()=>'B'}})
 try{let gate=h.render(()=>useRelatedSettingsEditor({},false,'hardware.manage'));assert.equal(gate.disabled,false);const ticket=gate.begin();assert.ok(ticket);companyId='C';gate=h.render(()=>useRelatedSettingsEditor({},false,'hardware.manage'));assert.equal(gate.isCurrent(ticket),false);h.unmount()}finally{global.window=previous}
 const other=hookHarness(),{useRelatedSettingsEditor:old}=loadReportModule('../config/useRelatedSettingsEditor.ts',{react:other.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissionsReady:true,hasPermission:code=>code==='hardware.manage'})},'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=>'B'}})
 try{assert.equal(other.render(()=>old({})).disabled,true)}finally{other.unmount()}
})
test('workspace drops stale tenant responses and rejects saves without manage even with view',async()=>{
 const h=hookHarness(),first=deferred(),second=deferred(),listeners=new Map(),previous=global.window
 global.window={addEventListener:(n,cb)=>listeners.set(n,cb),removeEventListener:(n,cb)=>{if(listeners.get(n)===cb)listeners.delete(n)}}
 let companyId='A',manage=false,calls=0,writes=0
 const hook=loadReportModule('../config/hardware/useHardwareWorkspace.ts',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:companyId},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissionsReady:true,hasPermission:code=>code==='hardware.view'||(manage&&code==='hardware.manage')})},'@/services/api':{getActiveCompanyId:()=>companyId,getActiveBranchId:()=>'B'},'./api':{getHardwareWorkspace:()=>++calls===1?first.promise:second.promise,saveHardwareWorkstation:async()=>{writes++}},}).useHardwareWorkspace
 try{let value=h.render(()=>hook({}));companyId='C';value=h.render(()=>hook({}));second.resolve({workstations:[],devices:[],assignments:[],registers:[],marker:'C'});await flush();value=h.render(()=>hook({}));assert.equal(value.workspace.marker,'C');first.resolve({marker:'A'});await flush();value=h.render(()=>hook({}));assert.equal(value.workspace.marker,'C');await value.saveWorkstation(null,{name:'unauthorized'});assert.equal(writes,0)}finally{h.unmount();global.window=previous}
})

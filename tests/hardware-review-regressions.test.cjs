const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{deferred,flush}=require('./helpers/configHarness.cjs')
test('NONE/TAB block implicit Enter but explicit search always works; Tab retains browser navigation',async()=>{
 for(const suffix of ['NONE','TAB']){
  const h=hookHarness(),nodes=[],calls=[],real=loadReportModule('../../services/scannerService.ts',{'@/services/api':{}})
  const {BarcodeLookup}=loadReportModule('../../components/shared/BarcodeLookup.tsx',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissionsReady:true,hasPermission:()=>true})},'@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['inventory'])})},'@/services/scannerService':{shouldSubmitScan:real.shouldSubmitScan,lookupScannedProduct:async(s,code)=>{calls.push(code);return null}}},nodes)
  const render=()=>{nodes.length=0;h.render(()=>BarcodeLookup())}
  try{render();nodes.find(n=>n.props.id==='scan-suffix').props.onChange({target:{value:suffix}});nodes.find(n=>n.props.id==='scan-code').props.onChange({target:{value:'00042'}});render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();assert.deepEqual(calls,[])
   if(suffix==='TAB'){let prevented=false;const target={tagName:'INPUT',id:'scan-code',type:'text'};nodes.find(n=>n.props.id==='scan-code').props.onKeyDown({key:'Tab',target,currentTarget:target,preventDefault(){prevented=true}});await flush();assert.equal(prevented,false)}
   else{nodes.find(n=>n.props.children==='Buscar producto').props.onClick();await flush()}
   assert.deepEqual(calls,['00042'])
  }finally{h.unmount()}
 }
})
test('two consecutive HID reads each query one code and restore the field for the next scan',async()=>{
 const h=hookHarness(),nodes=[],calls=[],previous=global.window
 global.window={addEventListener(){},removeEventListener(){}}
 const real=loadReportModule('../../services/scannerService.ts',{'@/services/api':{}})
 const {BarcodeLookup}=loadReportModule('../../components/shared/BarcodeLookup.tsx',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissionsReady:true,hasPermission:()=>true})},'@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['inventory'])})},'@/services/scannerService':{shouldSubmitScan:real.shouldSubmitScan,lookupScannedProduct:async(scope,code)=>{calls.push(code);return{id:'P',name:'Producto real',barcode:code}}}},nodes)
 const render=()=>{nodes.length=0;h.render(()=>BarcodeLookup())},input=()=>nodes.find(n=>n.props.id==='scan-code')
 let focused=0
 try{render();for(const code of ['00123','00456']){if(input().props.ref)input().props.ref.current={focus(){focused++},select(){}};input().props.onChange({target:{value:code}});render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render();await flush();render();assert.equal(input().props.value,'')}
 assert.deepEqual(calls,['00123','00456']);assert.equal(focused,2)
 }finally{h.unmount();global.window=previous}
})
test('pending assignments disable metadata edits without disabling their own save',()=>{
 const h=hookHarness(),nodes=[],{HardwareWorkstationEditor}=loadReportModule('../config/hardware/HardwareWorkstationEditor.tsx',{react:h.hooks},nodes)
 const station={id:'W',code:'PC',name:'Mostrador',notes:'',state:'ACTIVE',version:1,cashRegisterId:'R'},workspace={assignments:[],devices:[{id:'S',name:'Lector',kind:'SCANNER',state:'ACTIVE'}],registers:[{id:'R',name:'Caja',active:true}]}
 const render=()=>{nodes.length=0;h.render(()=>HardwareWorkstationEditor({station,workspace,disabled:false,fields:{},onSave:async()=>{},onAssign:async()=>{},onDirty(){},onBack(){}}))}
 try{render();nodes.find(n=>n.props.id==='hardware-role-SCANNER').props.onChange({target:{value:'S'}});render();assert.equal(nodes.find(n=>n.props.id==='hardware-name').props.disabled,true)
 const save=nodes.find(n=>n.props.children==='Guardar asignaciones');assert.equal(save.props.disabled,false)
 assert.ok(nodes.some(n=>n.props.children==='Restablecer asignaciones'))
 }finally{h.unmount()}
})
test('diagnostics honors a remembered workstation only after validating the current workspace',()=>{
 const previous=global.localStorage,map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};global.localStorage=storage
 const scope={companyId:'A',branchId:'B',userId:'U'},stations=[{id:'W1',name:'Primero',...scope,state:'ACTIVE'},{id:'W2',name:'Segundo',...scope,state:'ACTIVE'}]
 const model=loadReportModule('../config/hardware/model.ts');model.rememberWorkstation(scope,stations[1],storage)
 for(const disabled of [false,true]){
   const h=hookHarness(),nodes=[],{HardwareDiagnostics}=loadReportModule('../config/hardware/HardwareDiagnostics.tsx',{react:h.hooks,'@/services/api':{},'@/services/scannerService':{},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>false})},'@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set()})}},nodes)
   try{h.render(()=>HardwareDiagnostics({hardware:{...scope,workspace:{workstations:stations.map(s=>s.id==='W2'&&disabled?{...s,state:'DISABLED'}:s),devices:[],assignments:[]},canTestPrint:true,canTestDrawer:true}}));assert.equal(nodes.find(n=>n.props.id==='hardware-test-station').props.value,disabled?'W1':'W2')}finally{h.unmount()}
 }
 global.localStorage=previous
})
test('permission revoked and restored while a write is pending cannot revive its result or pending gate',async()=>{
 const h=hookHarness(),done=deferred(),previous=global.window,workspace={workstations:[],devices:[],assignments:[],registers:[]}
 let manage=true,writes=0;global.window={addEventListener(){},removeEventListener(){}}
 const {useHardwareWorkspace}=loadReportModule('../config/hardware/useHardwareWorkspace.ts',{react:h.hooks,'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({user:{id:'U'},permissionsReady:true,hasPermission:code=>code==='hardware.view'||manage&&code==='hardware.manage'})},'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=>'B'},'./api':{getHardwareWorkspace:async()=>workspace,saveHardwareWorkstation:()=>{writes++;return done.promise}}})
 try{let value=h.render(()=>useHardwareWorkspace({}));await flush();value=h.render(()=>useHardwareWorkspace({}));const request=value.saveWorkstation(null,{});value=h.render(()=>useHardwareWorkspace({}));assert.equal(value.pending,true);manage=false;value=h.render(()=>useHardwareWorkspace({}));manage=true;value=h.render(()=>useHardwareWorkspace({}));done.resolve({id:'OLD'});assert.equal(await request,null);await flush();value=h.render(()=>useHardwareWorkspace({}));assert.equal(value.pending,false);assert.equal(value.notice,'');assert.equal(writes,1)}finally{h.unmount();global.window=previous}
})

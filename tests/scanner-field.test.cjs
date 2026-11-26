const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const flush=()=>new Promise(r=>setImmediate(r))
test('explicit scanner field accepts Enter exactly once and a global prefix does not strip a barcode prefix twice',async()=>{
 const h=hookHarness(),nodes=[],reads=[],listeners=new Map();let scope='A',session='one'
 const previous=global.document;global.document={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),querySelector:()=>null}
 const {ScannerField}=loadReportModule('../../components/shared/ScannerField.tsx',{
  react:{...h.hooks,useId:()=> 'scan'},'@/services/authSession':{authSessionIdentity:()=>session},'@/services/contextScannerService':{operationalScanner:async()=>({profile:{scannerSuffix:'ENTER',scannerPrefix:'~',scannerMinLength:1,scannerMaxLength:100}})},
 },nodes)
 const render=()=>{nodes.length=0;h.render(()=>ScannerField({scopeKey:scope,onScan:async code=>reads.push(code)}))}
 try{render();await flush();render();nodes.find(n=>typeof n.props.onOpenChange==='function').props.onOpenChange(true);render();nodes.find(n=>n.props.id==='scan').props.onChange({target:{value:'00123'}});render()
  nodes.find(n=>n.props.id==='scan').props.onKeyDown({key:'Enter',nativeEvent:{},preventDefault(){},stopPropagation(){}});await flush();assert.deepEqual(reads,['00123'])
  const key=key=>listeners.get('keydown')({key,target:{closest:()=>null},preventDefault(){}})
  key('a');key('Enter');assert.deepEqual(reads,['00123']);for(const c of ['~','~','0','1','Enter'])key(c);await flush();assert.deepEqual(reads,['00123','~01'])
  const old=listeners.get('keydown');session='two';scope='B';render();old({key:'Enter',target:{closest:()=>null},preventDefault(){}});assert.equal(reads.length,2)
 }finally{h.unmount();global.document=previous}
})

function scanner({read=async()=>{},prefix='~'}={}){
 const h=hookHarness(),nodes=[],listeners=new Map();let scope='A',session='one',enabled=true
 const previous=global.document;global.document={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),querySelector:()=>null}
 const {ScannerField}=loadReportModule('../../components/shared/ScannerField.tsx',{
  react:{...h.hooks,useId:()=> 'scan'},'@/services/authSession':{authSessionIdentity:()=>session},'@/services/contextScannerService':{operationalScanner:async()=>({profile:{scannerSuffix:'ENTER',scannerPrefix:prefix,scannerMinLength:1,scannerMaxLength:100}})},
 },nodes)
 const render=()=>{nodes.length=0;h.render(()=>ScannerField({scopeKey:scope,enabled,onScan:read,label:'Agregar por código'}))}
 return{nodes,render,setScope:value=>{scope=value},setSession:value=>{session=value},setEnabled:value=>{enabled=value},open:()=>{nodes.find(n=>typeof n.props.onOpenChange==='function').props.onOpenChange(true);render()},key:key=>listeners.get('keydown')?.({key,target:{closest:()=>null},preventDefault(){}}),close:()=>{h.unmount();global.document=previous}}
}
test('manual code input stays unmounted until its compact action is opened',async()=>{
 const f=scanner()
 try{
  f.render();await flush();f.render()
  assert.equal(f.nodes.find(n=>n.props.id==='scan'),undefined)
  assert.ok(f.nodes.find(n=>n.props['aria-label']==='Ingresar código: Agregar por código'))
  f.open();assert.ok(f.nodes.find(n=>n.props.id==='scan'))
  f.nodes.find(n=>typeof n.props.onOpenChange==='function').props.onOpenChange(false);f.render()
  assert.equal(f.nodes.find(n=>n.props.id==='scan'),undefined)
 }finally{f.close()}
})
test('configured readers still scan automatically while the manual panel is closed',async()=>{
 const reads=[],f=scanner({read:async code=>reads.push(code)})
 try{f.render();await flush();f.render();for(const key of ['~','0','0','1','Enter'])f.key(key);await flush();f.render();assert.deepEqual(reads,['001']);assert.equal(f.nodes.find(n=>n.props.id==='scan'),undefined)}finally{f.close()}
})
test('automatic read errors open the floating correction field without losing the scanner',async()=>{
 let fail=true;const reads=[],f=scanner({read:async code=>{if(fail)throw Error('Código no encontrado');reads.push(code)}})
 try{
  f.render();await flush();f.render();for(const key of ['~','0','1','Enter'])f.key(key);await flush();f.render()
  assert.ok(f.nodes.find(n=>n.props.id==='scan'));assert.ok(f.nodes.find(n=>n.props.role==='alert'&&n.props.children==='Código no encontrado'))
  fail=false;f.nodes.find(n=>n.props.id==='scan').props.onChange({target:{value:'002'}});f.render();f.nodes.find(n=>n.props.id==='scan').props.onKeyDown({key:'Enter',nativeEvent:{},preventDefault(){},stopPropagation(){}});await flush();f.render()
  assert.deepEqual(reads,['002']);assert.equal(f.nodes.some(n=>n.props.role==='alert'),false)
 }finally{f.close()}
})
test('context changes and disabled actions close the manual panel and discard the partial code',async()=>{
 for(const change of ['setScope','setSession','setEnabled']){
  const f=scanner()
  try{f.render();await flush();f.render();f.open();f.nodes.find(n=>n.props.id==='scan').props.onChange({target:{value:'001'}});f.render();f[change](change==='setEnabled'?false:'new');f.render();f.render();assert.equal(f.nodes.find(n=>n.props.id==='scan'),undefined)}finally{f.close()}
 }
})
test('malformed automatic reads show a correction field instead of a hidden error',async()=>{
 const f=scanner()
 try{f.render();await flush();f.render();f.key('~');f.key('Enter');f.render();assert.ok(f.nodes.find(n=>n.props.id==='scan'));assert.ok(f.nodes.find(n=>n.props.role==='alert'))}finally{f.close()}
})
test('opening manual entry focuses the code without scrolling the page',async()=>{
 const f=scanner(),focus=[];let prevented=false
 try{
  f.render();await flush();f.render();f.open()
  const input=f.nodes.find(n=>n.props.id==='scan');assert.ok(input.props.ref)
  input.props.ref.current={focus:options=>focus.push(options)}
  f.nodes.find(n=>n.props.onOpenAutoFocus).props.onOpenAutoFocus({preventDefault(){prevented=true}})
  assert.equal(prevented,true);assert.deepEqual(focus,[{preventScroll:true}])
 }finally{f.close()}
})
test('closing manual entry restores the trigger without scrolling or stealing outside focus',async()=>{
 for(const outside of [false,true]){
  const f=scanner(),focus=[];let prevented=false
  try{
   f.render();await flush();f.render();f.open()
   const trigger=f.nodes.find(n=>n.props['data-scanner-trigger']);assert.ok(trigger.props.ref)
   trigger.props.ref.current={focus:options=>focus.push(options)}
   const panel=f.nodes.find(n=>n.props.onCloseAutoFocus)
   if(outside)panel.props.onInteractOutside({defaultPrevented:false})
   panel.props.onCloseAutoFocus({preventDefault(){prevented=true}})
   assert.equal(prevented,true);assert.deepEqual(focus,outside?[]:[{preventScroll:true}])
  }finally{f.close()}
 }
})

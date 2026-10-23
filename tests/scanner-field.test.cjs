const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const flush=()=>new Promise(r=>setImmediate(r))
test('explicit scanner field accepts Enter exactly once and a global prefix does not strip a barcode prefix twice',async()=>{
 const h=hookHarness(),nodes=[],reads=[],listeners=new Map();let scope='A',session='one'
 const previous=global.document;global.document={addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),querySelector:()=>null}
 const {ScannerField}=loadReportModule('../../components/shared/ScannerField.tsx',{
  react:{...h.hooks,useId:()=> 'scan'},'@/services/authSession':{authSessionIdentity:()=>session},'@/services/contextScannerService':{operationalScanner:async()=>({profile:{scannerSuffix:'ENTER',scannerPrefix:'~',scannerMinLength:1,scannerMaxLength:100}})},
 },nodes)
 const render=()=>{nodes.length=0;h.render(()=>ScannerField({scopeKey:scope,onScan:async code=>reads.push(code)}))}
 try{render();await flush();render();nodes.find(n=>n.props.id==='scan').props.onChange({target:{value:'00123'}});render()
  nodes.find(n=>n.props.id==='scan').props.onKeyDown({key:'Enter',nativeEvent:{},preventDefault(){},stopPropagation(){}});await flush();assert.deepEqual(reads,['00123'])
  const key=key=>listeners.get('keydown')({key,target:{closest:()=>null},preventDefault(){}})
  key('a');key('Enter');assert.deepEqual(reads,['00123']);for(const c of ['~','~','0','1','Enter'])key(c);await flush();assert.deepEqual(reads,['00123','~01'])
  const old=listeners.get('keydown');session='two';scope='B';render();old({key:'Enter',target:{closest:()=>null},preventDefault(){}});assert.equal(reads.length,2)
 }finally{h.unmount();global.document=previous}
})

const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('home scan opens permission-based actions without writing inventory and navigates to the real receipt route',async()=>{
 const h=hookHarness(),nodes=[],destinations=[],reads=[]
 const Page=loadReportModule('../../components/scanner/QuickProductScan.tsx',{
  react:h.hooks,'react-router-dom':{useNavigate:()=> (path,options)=>destinations.push({path,options})},
  '@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},isConsolidated:false})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/context/useModules':{useModules:()=>({isEnabled:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},
  '@/components/shared/ScannerField':{ScannerField:()=>null},'@/services/contextScannerService':{scannerIdentity:()=> 'same',resolveContextScan:async(code,operation)=>{reads.push({code,operation});return{product:{id:'P',name:'Agua',kind:'STANDARD',price:'5',stock:'12',available_for_sale:true}}}},
 },nodes).QuickProductScan
 const render=()=>{nodes.length=0;h.render(()=>Page())};render()
 await nodes.find(n=>n.type.name==='ScannerField').props.onScan('00123',new AbortController().signal);render()
 assert.ok(nodes.find(n=>n.type.name==='Dialog'&&n.props.open));assert.deepEqual(reads,[{code:'00123',operation:'LOOKUP'}])
 nodes.find(n=>n.props.children==='Preparar ingreso').props.onClick();assert.match(destinations[0].path,/^\/inventario\/registrar-ingreso\?/);assert.match(destinations[0].path,/codigo=00123/)
 h.unmount()
})
test('scanner transport discards an old session response and never truncates a code',async()=>{
 let session='one',calls=[]
 const {resolveContextScan}=loadReportModule('../../services/contextScannerService.ts',{'@/services/api':{getActiveCompanyId:()=> 'A',getActiveBranchId:()=> 'B',apiFetch:async(path,options)=>{calls.push({path,options});session='two';return{product:{id:'P'}}}},'@/services/authSession':{authSessionIdentity:()=>session}})
 await assert.rejects(resolveContextScan('00123','SALE'),{name:'AbortError'});assert.match(calls[0].path,/code=00123/);assert.equal(calls.length,1)
})
for(const [label,action,permission] of [['Mover entre ubicaciones','move','stock_moves.create'],['Reponer estante','replenishment','stock_moves.create'],['Registrar merma','loss','stock_moves.adjust'],['Registrar sobrante','surplus','stock_moves.adjust'],['Ver movimientos','history','products.view']])test(`scan prepares ${action} with exact product, code and session, never a stock write`,async()=>{
 const h=hookHarness(),nodes=[],destinations=[]
 const Page=loadReportModule('../../components/scanner/QuickProductScan.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=> (path,options)=>destinations.push({path,options})},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},isConsolidated:false})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:p=>['products.view',permission].includes(p)})},'@/context/useModules':{useModules:()=>({isEnabled:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ'})},'@/components/shared/ScannerField':{ScannerField:()=>null},'@/services/contextScannerService':{scannerIdentity:()=> 'same',resolveContextScan:async()=>({product:{id:'P',name:'Agua',kind:'STANDARD'}})}},nodes).QuickProductScan
 const render=()=>{nodes.length=0;h.render(()=>Page())}
 try{render();await nodes.find(n=>n.type.name==='ScannerField').props.onScan('00123',new AbortController().signal);render();const button=nodes.find(n=>n.props.children===label);assert.ok(button,`Missing ${label}`);button.props.onClick();assert.deepEqual(destinations,[{path:'/inventario/movimientos',options:{state:{stockScan:{action,code:'00123',productId:'P',identity:'same'}}}}]);if(permission==='products.view')assert.equal(nodes.some(n=>n.props.children==='Registrar merma'),false)}finally{h.unmount()}
})
test('services never offer physical movement actions and session changes hide the scanned product',async()=>{
 const h=hookHarness(),nodes=[];let identity='first'
 const Page=loadReportModule('../../components/scanner/QuickProductScan.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'},isConsolidated:false})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/context/useModules':{useModules:()=>({isEnabled:()=>true})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({})},'@/components/shared/ScannerField':{ScannerField:()=>null},'@/services/contextScannerService':{scannerIdentity:()=> identity,resolveContextScan:async()=>({product:{id:'P',name:'Consulta',kind:'SERVICE'}})}},nodes).QuickProductScan
 const render=()=>{nodes.length=0;h.render(()=>Page())}
 try{render();await nodes.find(n=>n.type.name==='ScannerField').props.onScan('00123',new AbortController().signal);render();assert.equal(nodes.some(n=>['Mover entre ubicaciones','Registrar merma','Registrar sobrante','Reponer estante'].includes(n.props.children)),false);identity='second';render();assert.equal(nodes.find(n=>n.type.name==='Dialog').props.open,false)}finally{h.unmount()}
})

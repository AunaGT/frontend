const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const product={id:'P',name:'Harina',kind:'STANDARD',stock:'999',unit_metadata_version:2,quantity_decimals:6,base_unit:{label:'kg'}}
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function dialog(task='move',initialKind='LOSS',read=async()=>[{stock:'1.25',location:{id:'from'}}],suggestion){
 const h=hookHarness(),nodes=[],writes=[]
 let identity='same'
 const Dialog=loadReportModule('../inventory/stock/StockOperationDialog.tsx',{react:h.hooks,'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}}),useMutation:o=>({mutate:()=>o.mutationFn(),isPending:false})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/services/stockMoveService':{fetchStockByLocation:read,createStockMove:async p=>writes.push(p),createAdjustment:async p=>writes.push(p)},'@/services/contextScannerService':{scannerIdentity:()=> identity},'@/services/api':{},'./api':{}},nodes).StockOperationDialog
 const render=()=>{nodes.length=0;h.render(()=>Dialog({task,initialKind,initialProduct:suggestion?undefined:product,suggestion,scanIdentity:'same',branchId:'B',locations:[{id:'from',label:'Bodega'},{id:'to',label:'Estante'}],onClose(){}}))}
 return{h,nodes,writes,render,setIdentity:value=>identity=value,byId:id=>nodes.find(n=>n.props.id===id),form:()=>nodes.find(n=>n.props.submitText==='Confirmar movimiento'||n.props.submitText==='Aplicar ajuste')}
}
test('scanned replenishment refuses confirmation when session changes without a rerender',async()=>{
 const r=dialog('move','LOSS',undefined,{product_id:'P',product_name:'Harina',suggested_qty:'1',from_stock:'2',from_location_id:'from',location_id:'to',quantity_decimals:6,base_unit:{label:'kg'}})
 try{r.render();r.setIdentity('new-session');await r.form().props.onSubmit();assert.deepEqual(r.writes,[])}finally{r.h.unmount()}
})
test('scanned product stays selected after origin changes and checks location stock, not branch total',async()=>{
 const r=dialog();try{r.render();assert.ok(r.nodes.some(n=>n.props['aria-label']==='Cantidad de Harina'));r.byId('operation-origin').props.onChange({target:{value:'from'}});r.byId('operation-destination').props.onChange({target:{value:'to'}});r.render();await tick();r.render();r.nodes.find(n=>n.props['aria-label']==='Cantidad de Harina').props.onChange({target:{value:'2'}});r.render();r.form().props.onSubmit();assert.deepEqual(r.writes,[]);assert.ok(r.nodes.length);r.render();assert.ok(r.nodes.some(n=>n.props.role==='alert'));r.nodes.find(n=>n.props['aria-label']==='Cantidad de Harina').props.onChange({target:{value:'0.123456'}});r.render();await r.form().props.onSubmit();assert.deepEqual(r.writes,[{from_location_id:'from',to_location_id:'to',lines:[{product_id:'P',qty:'0.123456'}],notes:undefined}])}finally{r.h.unmount()}
})
test('surplus prepares a positive base-unit adjustment and still requires quantity and reason',async()=>{
 const r=dialog('adjust','SURPLUS',()=>assert.fail('Surplus must not require existing stock'));try{r.render();assert.equal(r.byId('operation-kind').props.value,'SURPLUS');r.byId('operation-origin').props.onChange({target:{value:'from'}});r.render();r.form().props.onSubmit();assert.deepEqual(r.writes,[]);r.byId('adjust-notes').props.onChange({target:{value:'Encontrado al contar'}});r.nodes.find(n=>n.props['aria-label']==='Cantidad de Harina').props.onChange({target:{value:'0.25'}});r.render();await r.form().props.onSubmit();assert.deepEqual(r.writes,[{location_id:'from',lines:[{product_id:'P',qty:'0.25'}],notes:'Encontrado al contar'}])}finally{r.h.unmount()}
})
test('failed location lookup cannot submit a loss or fall back to branch stock',async()=>{
 const r=dialog('adjust','LOSS',async()=>{throw Error('Sin conexión')});try{r.render();r.byId('operation-origin').props.onChange({target:{value:'from'}});r.render();await tick();r.render();r.byId('adjust-notes').props.onChange({target:{value:'Dañado'}});r.nodes.find(n=>n.props['aria-label']==='Cantidad de Harina').props.onChange({target:{value:'1'}});r.render();r.form().props.onSubmit();assert.deepEqual(r.writes,[]);assert.equal(r.form().props.submitDisabled,true)}finally{r.h.unmount()}
})
test('location lookup can be retried without discarding the scanned product',async()=>{
 let attempts=0
 const r=dialog('adjust','LOSS',async()=>{if(!attempts++)throw Error('Sin conexión');return[{stock:'1.25',location:{id:'from'}}]})
 try{r.render();r.byId('operation-origin').props.onChange({target:{value:'from'}});r.render();await tick();r.render();const retry=r.nodes.find(n=>n.props.children==='Reintentar existencia');assert.ok(retry);retry.props.onClick();r.render();await tick();r.render();assert.equal(r.form().props.submitDisabled,false);assert.ok(r.nodes.some(n=>n.props['aria-label']==='Cantidad de Harina'))}finally{r.h.unmount()}
})
function workspace(action='move',{identity='same',allowed=true,resolve=async()=>({product})}={}){
 const h=hookHarness(),nodes=[],queries=[],reads=[],destinations=[]
 const intent={action,identity,code:'00123',productId:'P'}
 const Page=loadReportModule('../inventory/stock/StockMovesPage.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=> (path,options)=>destinations.push({path,options})},'@/context/useTenant':{useTenant:()=>({company:{id:'A'},branch:{id:'B'}})},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>allowed})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',timezone:'America/Guatemala'})},'@/components/layout/PageNavigation':{usePageTrail(){}},'@/hooks/usePersistedListUiState':{usePersistedListUiState:()=>({page:1,pageSize:10,setPage(){},setPageSize(){}})},'@tanstack/react-query':{useQuery:options=>{queries.push(options);return{data:options.queryKey[0]==='warehouses'?[{active:true,name:'Bodega',locations:[{id:'from',active:true,code:'A'},{id:'to',active:true,code:'B'}]}]:options.queryKey[0]==='stock-replenishment'?[{product_id:'P',product_name:'Harina',location_id:'to',location_code:'B',stock:'0',min_stock:'1',missing:'1',suggested_qty:'1'},{product_id:'OTHER',product_name:'Otro producto',location_id:'to',location_code:'B',suggested_qty:'1'}]:{items:[]},isLoading:false}}},'@/services/contextScannerService':{scannerIdentity:()=> 'same',resolveContextScan:resolve},'@/services/stockMoveService':{REASON_LABELS:{},fetchMovementPage:async options=>reads.push(options)},'@/services/api':{},'./api':{}},nodes).StockMovesWorkspace
 const render=()=>{nodes.length=0;queries.length=0;h.render(()=>Page({scanIntent:intent}))}
 return{h,nodes,queries,reads,destinations,render}
}
for(const action of ['move','loss','surplus'])test(`movement workspace re-resolves scanned ${action} and only prepares the matching dialog`,async()=>{
 const old=global.window;global.window={setTimeout:()=>1,clearTimeout(){}};const r=workspace(action)
 try{r.render();await tick();r.render();const d=r.nodes.find(n=>n.type.name==='StockOperationDialog');assert.ok(d);assert.equal(d.props.initialProduct.id,'P');assert.equal(d.props.task,action==='move'?'move':'adjust');assert.equal(d.props.initialKind,action==='surplus'?'SURPLUS':'LOSS');assert.equal(d.props.scanIdentity,'same');assert.deepEqual(r.destinations,[{path:'/inventario/movimientos',options:{replace:true,state:null}}])}finally{r.h.unmount();global.window=old}
})
test('scanned history uses exact product ID and replenishment excludes other products',async()=>{
 const old=global.window;global.window={setTimeout:()=>1,clearTimeout(){}}
 try{for(const action of ['history','replenishment']){const r=workspace(action);try{r.render();await tick();r.render();assert.equal(r.nodes.some(n=>n.type.name==='StockOperationDialog'),false);if(action==='history'){await r.queries.find(q=>q.queryKey[0]==='stock-moves').queryFn();assert.equal(r.reads[0].product_id,'P')}else{assert.ok(r.nodes.some(n=>n.props.value==='replenishment'));assert.equal(r.nodes.some(n=>n.type==='strong'&&n.props.children==='Otro producto'),false);assert.ok(r.nodes.some(n=>n.type==='strong'&&n.props.children==='Harina'))}}finally{r.h.unmount()}}}finally{global.window=old}
})
test('clearing history filters also removes the exact scanned product constraint',async()=>{
 const old=global.window;global.window={setTimeout:()=>1,clearTimeout(){}};const r=workspace('history')
 try{r.render();await tick();r.render();r.nodes.find(n=>n.type.name==='CompactFilterPanel').props.onClear();r.render();await r.queries.find(q=>q.queryKey[0]==='stock-moves').queryFn();assert.equal(r.reads[0].product_id,undefined)}finally{r.h.unmount();global.window=old}
})
for(const options of [{identity:'old'},{allowed:false},{resolve:async()=>({product:{...product,id:'OTHER'}})},{resolve:async()=>({product:{...product,kind:'SERVICE'}})}])test(`invalid scanned movement cannot prepare a dialog (${JSON.stringify(options)})`,async()=>{
 const old=global.window;global.window={setTimeout:()=>1,clearTimeout(){}};const r=workspace('move',options)
 try{r.render();await tick();r.render();assert.equal(r.nodes.some(n=>n.type.name==='StockOperationDialog'),false);assert.ok(r.nodes.some(n=>n.props.role==='alert'))}finally{r.h.unmount();global.window=old}
})

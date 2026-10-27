const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('package strip shows backend totals above filters and hides stale counts after a failed search',async()=>{
 const h=hookHarness(),nodes=[],requests=[]
 const {PackageLibrary}=loadReportModule('../inventory/packages/PackageListPage.tsx',{react:h.hooks,'react-router-dom':{...require('react-router-dom'),useNavigate:()=>()=>{}},'@/components/scanner/QuickProductScan':{QuickProductScan:()=>null},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryServicesEnabled:true})},'./api':{fetchPackages:(_scope,query)=>new Promise((resolve,reject)=>requests.push({query,resolve,reject})),packageError:e=>e.message}},nodes)
 const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'},render=()=>{nodes.length=0;h.render(()=>PackageLibrary({scope,canEdit:true}))},wait=()=>new Promise(r=>setTimeout(r,170)),strip=()=>nodes.find(n=>n.type?.name==='MetricStrip')
 render();assert.ok(strip(),'Reuse inventory MetricStrip');assert.equal(strip().props.loading,true)
 await wait();assert.equal(requests[0].query.includeSummary,true)
 requests[0].resolve({items:[{id:'p',name:'Fiesta',branchIds:['b'],version:1}],nextCursor:null,summary:{total:60,active:30,draft:20,archived:10}})
 await new Promise(setImmediate);render();assert.equal(strip().props.loading,false)
 assert.deepEqual(strip().props.items.map(x=>[x.label,x.value]),[['Paquetes',60],['Activos',30],['Borradores',20],['Archivados',10]])
 const main=nodes.find(n=>n.type==='main'),children=main.props.children
 assert.ok(children.findIndex(n=>n?.type?.name==='MetricStrip')<children.findIndex(n=>n?.props?.className==='auna-list-toolbar space-y-3'))
 nodes.find(n=>n.props.id==='package-search').props.onChange({target:{value:'otra'}});render();await wait();requests[1].reject(Error('Sin conexión'));await new Promise(setImmediate);render()
 assert.deepEqual(strip().props.items.map(x=>x.value),['—','—','—','—']);h.unmount()
})

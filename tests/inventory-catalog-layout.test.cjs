const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {MemoryRouter}=require('react-router-dom')
test('catalog navigation exposes packages alongside products, without offering disabled services',()=>{
 const nodes=[],{InventoryCatalogNav}=loadReportModule('../inventory/components/InventoryCatalogNav.tsx',{},nodes),changes=[]
 const render=servicesEnabled=>renderToStaticMarkup(React.createElement(InventoryCatalogNav,{value:'goods',servicesEnabled,onValueChange:v=>changes.push(v)}))
 assert.match(render(false),/Productos/);assert.doesNotMatch(render(false),/>Servicios</)
 assert.match(render(true),/>Servicios</)
 nodes.find(n=>n.props.children?.[1]==='Paquetes').props.onClick()
 assert.deepEqual(changes,['packages'])
})
test('packages reuse inventory toolbar and put creation next to search instead of a separate top header',()=>{
 for(const canEdit of [true,false]){
  const nodes=[],{PackageLibrary}=loadReportModule('../inventory/packages/PackageListPage.tsx',{'./api':{},'@/components/scanner/QuickProductScan':{QuickProductScan:()=>null},'@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryServicesEnabled:true})}},nodes)
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(PackageLibrary,{scope:{companyId:'a',branchId:'b',userId:'u',sessionId:'s'},canEdit})))
  const toolbar=nodes.find(n=>n.type?.name==='CompactFilterPanel');assert.ok(toolbar,'Same search/filter/action toolbar as inventory')
  const actions=renderToStaticMarkup(React.createElement(MemoryRouter,null,toolbar.props.actions))
  assert.equal(actions.includes('Nuevo paquete'),canEdit);assert.match(actions,/Acciones/)
  assert.ok(html.indexOf('Catálogo de inventario')<html.indexOf('compact-filter-toolbar'))
  assert.doesNotMatch(html,/>Inventario<\/a>/,'Tabs already provide the return path')
 }
})

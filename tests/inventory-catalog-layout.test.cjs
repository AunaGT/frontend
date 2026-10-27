const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('catalog navigation exposes packages alongside products, without offering disabled services',()=>{
 const nodes=[],{InventoryCatalogNav}=loadReportModule('../inventory/components/InventoryCatalogNav.tsx',{},nodes),changes=[]
 const render=servicesEnabled=>renderToStaticMarkup(React.createElement(InventoryCatalogNav,{value:'goods',servicesEnabled,onValueChange:v=>changes.push(v)}))
 assert.match(render(false),/Productos/);assert.doesNotMatch(render(false),/>Servicios</)
 assert.match(render(true),/>Servicios</)
 nodes.find(n=>n.props.children?.[1]==='Paquetes').props.onClick()
 assert.deepEqual(changes,['packages'])
})

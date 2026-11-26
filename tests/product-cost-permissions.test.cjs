const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('creating products is not authority to display a product cost or profit',()=>{
 for(const [permissions,visible]of [[['products.create'],false],[['products.view_costs'],true]]){
  const nodes=[],{ProductDetailDialog}=loadReportModule('../inventory/products/components/ProductDetailDialog.tsx',{
   '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:p=>permissions.includes(p)})},
  },nodes)
  renderToStaticMarkup(React.createElement(ProductDetailDialog,{open:false,onOpenChange(){},product:{id:'P',name:'Producto',price:10,cost:4,stock:3,minStock:1}}))
  assert.equal(nodes.some(n=>n.props.children==='Costo'),visible)
  assert.equal(nodes.some(n=>n.props.children==='Precio de Venta'),true)
 }
})

const test=require('node:test')
const assert=require('node:assert/strict')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('shared picker asks for enabled services only in commercial operations',async()=>{
  for(const props of [{},{purchase:true,supplierId:'supplier'},{inventory:true}]){
    let query,request
    const {ProductPicker}=loadReportModule('../../components/shared/ProductPicker.tsx',{
      '@/services/api':{apiFetch(){throw Error('No network in picker presentation test')}},
      '@tanstack/react-query':{useInfiniteQuery:options=>{query=options;return{}}},
      '@/hooks/useSystemSettings':{useSystemSettings:()=>({inventoryServicesEnabled:true})},
      '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},
      '@/services/productService':{fetchProducts:async options=>{request=options;return{items:[]}},adaptApiProduct:p=>p},
    })
    renderToStaticMarkup(React.createElement(ProductPicker,{branchId:'B',onPick(){},...props}))
    await query.queryFn({pageParam:1})
    assert.equal(request.catalogType,props.purchase||props.inventory?'goods':'all')
  }
})
test('purchase picker never presents a hidden product cost as a free item',()=>{
 const nodes=[],{ProductPicker}=loadReportModule('../../components/shared/ProductPicker.tsx',{
  '@/services/api':{},
  '@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>false})},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({})},
  '@tanstack/react-query':{useInfiniteQuery:()=>({data:{pages:[{items:[{id:'p',name:'Producto',cost:0,price:10,stock:2}]}]}})},
  '@/services/productService':{adaptApiProduct:p=>p},
 },nodes)
 renderToStaticMarkup(React.createElement(ProductPicker,{purchase:true,branchId:'B',onPick(){}}))
 assert.ok(nodes.some(n=>n.props.children==='Ingresa el costo'))
})

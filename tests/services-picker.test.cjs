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
      '@/services/productService':{fetchProducts:async options=>{request=options;return{items:[]}},adaptApiProduct:p=>p},
    })
    renderToStaticMarkup(React.createElement(ProductPicker,{branchId:'B',onPick(){},...props}))
    await query.queryFn({pageParam:1})
    assert.equal(request.catalogType,props.purchase||props.inventory?'goods':'all')
  }
})

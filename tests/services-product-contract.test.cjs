const test=require('node:test')
const assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('product adapter preserves service identity and serializes catalog type for lists and commercial pickers',async()=>{
  const requests=[]
  const service=loadReportModule('../../services/productService.ts',{'./api':{apiFetch:async url=>{requests.push(url);return{items:[]}}}})
  const item=service.adaptApiProduct({id:'s',name:'Asesoría',kind:'SERVICE',service_unit_label:'Hora',quantity_decimals:3,stock:0,supplier:null,available_for_sale:true})
  assert.equal(item.kind,'SERVICE')
  assert.equal(item.serviceUnitLabel,'Hora')
  assert.equal(item.quantityDecimals,3)
  await service.fetchProducts({catalogType:'services'})
  assert.equal(new URL(requests[0],'https://qa.test').searchParams.get('catalog_type'),'services')
  await service.fetchAllProducts({forSaleOnly:true,catalogType:'all'})
  assert.equal(new URL(requests[1],'https://qa.test').searchParams.get('catalog_type'),'all')
})
test('commercial catalog fetches every server page rather than requesting an oversized page',async()=>{
  const requests=[]
  const service=loadReportModule('../../services/productService.ts',{'./api':{apiFetch:async url=>{
    requests.push(url)
    const page=Number(new URL(url,'https://qa.test').searchParams.get('page'))
    return {items:[{id:String(page),name:`Item ${page}`}],totalPages:2}
  }}})
  const products=await service.fetchAllProducts({catalogType:'all'})
  assert.deepEqual(Array.from(products,p=>p.id),['1','2'])
  assert.equal(requests.length,2)
  assert.equal(new URL(requests[1],'https://qa.test').searchParams.get('pageSize'),'100')
})

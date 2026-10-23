const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('compact checkout changes representation without changing the saved commercial payload or legacy API',async()=>{
 const calls=[],api=loadReportModule('../../services/saleService.ts',{'./api':{apiFetch:async(path,options)=>{calls.push({path,options});return{id:'V',checkout_state:'CONFIRMED'}}}}),payload={items:[{product_id:'P',qty:'1',price:'2'}],idempotency_key:'same-key'},headers={'X-Company-Id':'C','X-Branch-Id':'B'}
 assert.equal(typeof api.createSaleConfirmation,'function')
 await api.createSaleConfirmation(payload,{headers});await api.createSale(payload,{headers})
 assert.equal(calls[0].path,'/api/sales?response=confirmation');assert.equal(calls[1].path,'/api/sales')
 assert.deepEqual(JSON.parse(calls[0].options.body),payload);assert.equal(calls[0].options.body,calls[1].options.body);assert.deepEqual(calls[0].options.headers,headers)
})

const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('returns validate snapshot quantities, preserve final cents and omit physical service decisions',()=>{
  const {returnQuantity,estimateLineRefund,returnLineDecision}=loadReportModule('../returns/returnQuantity.ts',{'@/services/api':{}})
  const item={id:1,qty:'1.5',item_kind:'SERVICE',quantity_decimals:2,unit_label:'Hora',available_to_return:'1',net_total:150,refundable_amount:100}
  assert.equal(returnQuantity('0.5',item,'es-GT'),'0.5')
  assert.equal(returnQuantity('1.01',item,'es-GT'),null)
  assert.equal(returnQuantity('0.501',item,'es-GT'),null)
  assert.equal(estimateLineRefund('0.5',item),50)
  assert.equal(estimateLineRefund('1',{...item,qty:'3',net_total:10,refundable_amount:3.34}),3.34)
  assert.deepEqual(returnLineDecision({id:1,qty_returned:'0.5',sale_item:item},{disposition:'SELLABLE',stock_location_id:'L'},true),{return_item_id:1})
  assert.equal(returnLineDecision({id:2,qty_returned:'2',sale_item:{item_kind:'STANDARD'}},{disposition:'SCRAP'},true).received_qty,2)
})

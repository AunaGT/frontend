const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('internal document titles distinguish drafts and never claim to be a fiscal invoice',()=>{
  const {internalSaleDocumentTitle}=loadReportModule('../sales/commercialPresentation.ts')
  assert.equal(internalSaleDocumentTitle('DRAFT'),'Borrador de venta')
  assert.equal(internalSaleDocumentTitle('CONFIRMED'),'Comprobante interno de venta')
  assert.match(internalSaleDocumentTitle('CANCELLED'),/cancelada/)
})

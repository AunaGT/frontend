const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('V2 ticket downloads its authorized stored artifact and never invokes a frontend PDF builder',async()=>{
  const blob=new Blob(['%PDF-frozen'],{type:'application/pdf'}),calls=[]
  const {renderPrintSource}=loadReportModule('../../services/printRenderers.ts',{'@/modules/config/hardware/public':{preparedSaleDocument:async(scope,source)=>{calls.push({scope,source});return {blob,filename:'original.pdf'}}},'@/modules/sales/documents/generateSaleTicket':{buildSaleTicketPdf:()=>assert.fail('Do not redraw V2')}})
  const result=await renderPrintSource({version:2,renderer:'SALE_DOCUMENT_V2',saleId:'sale',artifactId:'artifact',snapshotId:'snapshot',format:'RECEIPT_80',branding:{companyId:'A',branchId:'B',userId:'U',jobId:'job'}},'MAIN')
  assert.equal(result.blob,blob);assert.equal(calls[0].source.artifactId,'artifact')
})
test('an unknown tracked ticket outcome cannot silently fall back to current sale data',async()=>{
  const {downloadSavedSaleTicket}=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/modules/config/hardware/public':{createPrintJobWithDocument:async()=>{throw Object.assign(new Error('offline'),{status:503})},mayUseUntrackedPdf:()=>true},'@/services/saleService':{fetchSaleById:()=>assert.fail('No mutable fallback after unknown V2 outcome')},'@/utils/pdfBranding':{},'./generateSaleTicket':{}})
  await assert.rejects(downloadSavedSaleTicket('sale',{},()=>true,undefined,{scope:{companyId:'A',branchId:'B',userId:'U'}}),{status:503})
})

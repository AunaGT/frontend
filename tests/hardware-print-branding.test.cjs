const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('print rendering reads only the job scoped immutable logo, not current company branding',async()=>{
 let saved
 const {renderPrintSource}=loadReportModule('../../services/printRenderers.ts',{'@/modules/config/hardware/public':{printJobLogo:async(scope,id)=>{assert.equal(scope.companyId,'A');assert.equal(id,'J');return'old-image'}},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>{throw Error('current branding forbidden')}},'@/modules/sales/documents/generateSaleTicket':{buildSaleTicketPdf:(sale,options)=>{saved=options;return{blob:new Blob(['pdf']),filename:'ticket.pdf'}}}})
 await renderPrintSource({version:1,renderer:'SALE_TICKET_V1',sale:{id:'S'},options:{companyName:'Original',logoUrl:'old-url'},branding:{jobId:'J',companyId:'A',branchId:'B'}},'MAIN')
 assert.equal(saved.logoDataUrl,'old-image');assert.equal(saved.companyName,'Original')
})

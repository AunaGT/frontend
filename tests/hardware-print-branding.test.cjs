const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
for(const logo of ['data:image/png;base64,UE5H',''])test(`ticket envelope ${logo?'with logo':'without optional logo'} renders without a separate logo request`,async()=>{
 let options;const notices=[]
 const {renderPrintSource}=loadReportModule('../../services/printRenderers.ts',{'@/modules/config/hardware/public':{printJobLogo:async()=>assert.fail('Extra authorization/asset request must not be needed')},'@/modules/sales/documents/generateSaleTicket':{buildSaleTicketPdf:(_sale,input)=>{options=input;return{blob:new Blob(['%PDF-QA']),filename:'ticket.pdf'}}}})
 await renderPrintSource({version:1,renderer:'SALE_TICKET_V1',sale:{id:'S'},options:{logoUrl:'original',logoDataUrl:logo},branding:{jobId:'J',companyId:'A',branchId:'B'}},'MAIN',{allowMissingLogo:true,notice:n=>notices.push(n)})
 assert.equal(options.logoDataUrl,logo||undefined);assert.equal(notices.length,logo?0:1)
})
test('print rendering reads only the job scoped immutable logo, not current company branding',async()=>{
 let saved
 const {renderPrintSource}=loadReportModule('../../services/printRenderers.ts',{'@/modules/config/hardware/public':{printJobLogo:async(scope,id)=>{assert.equal(scope.companyId,'A');assert.equal(id,'J');return'old-image'}},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>{throw Error('current branding forbidden')}},'@/modules/sales/documents/generateSaleTicket':{buildSaleTicketPdf:(sale,options)=>{saved=options;return{blob:new Blob(['pdf']),filename:'ticket.pdf'}}}})
 await renderPrintSource({version:1,renderer:'SALE_TICKET_V1',sale:{id:'S'},options:{companyName:'Original',logoUrl:'old-url'},branding:{jobId:'J',companyId:'A',branchId:'B'}},'MAIN')
 assert.equal(saved.logoDataUrl,'old-image');assert.equal(saved.companyName,'Original')
})
for(const status of [503,401,403,409,'abort'])test(`POS logo failure ${status} respects document access while allowing optional branding outages`,async()=>{
 let built=0;const notices=[],error=Object.assign(Error('logo unavailable'),status==='abort'?{name:'AbortError'}:{status})
 const {renderPrintSource}=loadReportModule('../../services/printRenderers.ts',{'@/modules/config/hardware/public':{printJobLogo:async()=>{throw error},mayUseUntrackedPdf:e=>e.status===undefined||e.status>=500},'@/modules/sales/documents/generateSaleTicket':{buildSaleTicketPdf:(_sale,options)=>{built++;assert.equal(options.logoDataUrl,undefined);return{blob:new Blob(['%PDF-QA']),filename:'ticket.pdf'}}}})
 const run=()=>renderPrintSource({version:1,renderer:'SALE_TICKET_V1',sale:{id:'S'},options:{companyName:'Original',logoUrl:'old'},branding:{jobId:'J',companyId:'A',branchId:'B'}},'MAIN',{allowMissingLogo:true,notice:n=>notices.push(n)})
 if(status===503){await run();assert.equal(built,1);assert.equal(notices.length,1)}else{await assert.rejects(run(),e=>e===error);assert.equal(built,0)}
})

const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const sale={id:'V',reference:'V-TEST',date:'2026-10-17T12:00:00Z',customer:'CF',total:25,subtotal:25,items:1,status:{name:'Completada'},sale_items:[{item_name:'Archived service snapshot',unit_label:'Hour',qty:1,price:25,product:null}]}
test('ticket builder returns a real PDF with persisted snapshots and does not download',async()=>{
 const api=loadReportModule('../sales/documents/generateSaleTicket.ts',{'@/services/api':{},'@/utils/formatters':{formatMoney:n=>String(n),formatDateTime:()=> '2026-10-17'},'@/utils/pdfBranding':{addJsPdfLogoCentered:()=>0}})
 assert.equal(typeof api.buildSaleTicketPdf,'function')
 const result=api.buildSaleTicketPdf(sale,{companyName:'Test company'})
 assert.ok(result.blob instanceof Blob);assert.match(result.filename,/V-TEST/)
 const text=await result.blob.text();assert.ok(text.startsWith('%PDF-'));assert.match(text,/Archived service/)
})
test('ticket recovery only loads the saved sale and tolerates missing logo',async()=>{
 let saved,loads=0
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/saleService':{fetchSaleById:async id=>{assert.equal(id,'V');loads++;return sale}},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>{throw Error('logo failed')}},'./generateSaleTicket':{generateSaleTicket:(row,options)=>{saved={row,options}}}})
 await api.downloadSavedSaleTicket('V',{companyName:'Test',logoUrl:'broken'})
 assert.equal(loads,1);assert.equal(saved.row.sale_items[0].item_name,'Archived service snapshot');assert.equal(saved.options.logoDataUrl,undefined)
})
test('late ticket recovery does not download a previous user or tenant document',async()=>{
 let current=true,downloads=0
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/saleService':{fetchSaleById:async()=>{current=false;return sale}},'./generateSaleTicket':{generateSaleTicket:()=>downloads++},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{},()=>current),e=>e.name==='AbortError');assert.equal(downloads,0)
})
test('cookie identity change blocks ticket download even if caller does not provide a guard',async()=>{
 const map=new Map([['auth:user',JSON.stringify({id:'U'})]]),before=global.localStorage;global.localStorage={getItem:k=>map.get(k)??null}
 let downloads=0
 try{const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/saleService':{fetchSaleById:async()=>{map.set('auth:user',JSON.stringify({id:'U2'}));return sale}},'./generateSaleTicket':{generateSaleTicket:()=>downloads++},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{}),e=>e.name==='AbortError');assert.equal(downloads,0)
 }finally{global.localStorage=before}
})
test('revoked print-source permission cannot be bypassed through conventional ticket fallback',async()=>{
 let conventional=0
 const {mayUseUntrackedPdf}=loadReportModule('../config/hardware/printing/flow.ts')
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/api':{},'@/modules/config/hardware/public':{mayUseUntrackedPdf,createPrintJob:async()=>{throw Object.assign(Error('denied'),{status:403})}},'@/services/saleService':{fetchSaleById:async()=>{conventional++;return sale}},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{},()=>true,undefined,{scope:{companyId:'C',branchId:'B',userId:'U'}}),e=>e.status===403);assert.equal(conventional,0)
})

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
test('an unscoped ticket cannot silently use the old frontend renderer',async()=>{
 let saved,loads=0
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/saleService':{fetchSaleById:async id=>{assert.equal(id,'V');loads++;return sale}},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>{throw Error('logo failed')}},'./generateSaleTicket':{generateSaleTicket:(row,options)=>{saved={row,options}}}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{companyName:'Test',logoUrl:'broken'}),/empresa y sucursal/)
 assert.equal(loads,0);assert.equal(saved,undefined)
})
test('late ticket recovery does not download a previous user or tenant document',async()=>{
 let current=false,downloads=0
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/saleService':{fetchSaleById:async()=>{current=false;return sale}},'./generateSaleTicket':{generateSaleTicket:()=>downloads++},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{},()=>current),e=>e.name==='AbortError');assert.equal(downloads,0)
})
test('missing scope blocks a ticket before any mutable sale read or download',async()=>{
 const map=new Map([['auth:user',JSON.stringify({id:'U'})]]),before=global.localStorage;global.localStorage={getItem:k=>map.get(k)??null}
 let downloads=0
 try{const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/saleService':{fetchSaleById:async()=>{map.set('auth:user',JSON.stringify({id:'U2'}));return sale}},'./generateSaleTicket':{generateSaleTicket:()=>downloads++},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{}),/empresa y sucursal/);assert.equal(downloads,0)
 }finally{global.localStorage=before}
})
test('revoked print-source permission cannot be bypassed through conventional ticket fallback',async()=>{
 let conventional=0
 const {mayUseUntrackedPdf}=loadReportModule('../config/hardware/printing/flow.ts')
 const denied=async()=>{throw Object.assign(Error('denied'),{status:403})}
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/api':{},'@/modules/config/hardware/public':{mayUseUntrackedPdf,createPrintJob:denied,createPrintJobWithDocument:denied},'@/services/saleService':{fetchSaleById:async()=>{conventional++;return sale}},'@/utils/pdfBranding':{resolvePdfLogoDataUrl:async()=>undefined}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{},()=>true,undefined,{scope:{companyId:'C',branchId:'B',userId:'U'}}),e=>e.status===403);assert.equal(conventional,0)
})
function tracked({failure,status,changeAt}={}){
 let current=true;const calls=[],downloads=[],notices=[]
 const record=async name=>{calls.push(name);if(changeAt===name)current=false;if(failure===name)throw Object.assign(Error('unavailable'),status?{status}:{})}
 const {mayUseUntrackedPdf}=loadReportModule('../config/hardware/printing/flow.ts')
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/api':{},'@/utils/pdfBranding':{},'./generateSaleTicket':{},'@/services/authSession':{authSessionIdentity:()=> 'session'},'@/services/saleService':{fetchSaleById:()=>assert.fail('No conventional fallback after authorized render')},
  '@/modules/config/hardware/public':{mayUseUntrackedPdf,createPrintJobWithDocument:async()=>{await record('CREATE');return{job:{id:'J'},document:{version:1}}},createPrintJob:async()=>{await record('CREATE');return{id:'J'}},printDocument:async()=>{await record('DOCUMENT');return{}},printEvent:async(_,__,event)=>record(event),requestPreparedDownload:async()=>record('EVENTS')},
  '@/services/printRenderers':{renderPrintSource:async()=>{await record('RENDER');return{blob:new Blob(['%PDF-QA']),filename:'ticket.pdf'}}},'@/modules/reports/documents/reportDownload':{downloadReportBlob:(blob,name)=>downloads.push({blob,name})}})
 return{calls,downloads,notices,run:()=>api.downloadSavedSaleTicket('V',{},()=>current,undefined,{scope:{companyId:'C',branchId:'B',userId:'U'},notice:n=>notices.push(n)})}
}
test('tracked ticket uses the document envelope and grouped events before one download',async()=>{const h=tracked();await h.run();assert.deepEqual(h.calls,['CREATE','RENDER','EVENTS']);assert.equal(h.downloads.length,1);assert.equal(h.notices.length,0)})
for(const status of [undefined,503])test(`ticket still downloads a valid PDF when audit fails with ${status??'network error'}`,async()=>{const h=tracked({failure:'EVENTS',status});await h.run();assert.equal(h.downloads.length,1);assert.equal(h.notices.length,1);assert.equal(h.calls.includes('FAILED'),false)})
for(const status of [401,403,409])test(`audit ${status} never permits a ticket download`,async()=>{const h=tracked({failure:'EVENTS',status});await assert.rejects(h.run(),e=>e.status===status);assert.equal(h.downloads.length,0)})
test('changed owner after audit prevents the prepared PDF download',async()=>{const h=tracked({changeAt:'EVENTS'});await assert.rejects(h.run(),e=>e.name==='AbortError');assert.equal(h.downloads.length,0)})
for(const status of [401,403,409,503])test(`ticket preparation failure ${status} never rebuilds an old ticket`,async()=>{
 let reads=0,downloads=0
 const api=loadReportModule('../sales/documents/saleTicketRecovery.ts',{'@/services/saleService':{fetchSaleById:async()=>{reads++;return sale}},'./generateSaleTicket':{generateSaleTicket:()=>downloads++},'@/modules/config/hardware/public':{createPrintJobWithDocument:async()=>{throw Object.assign(Error('unavailable'),{status})}}})
 await assert.rejects(api.downloadSavedSaleTicket('V',{},()=>true,undefined,{scope:{companyId:'C',branchId:'B',userId:'U'}}),e=>e.status===status)
 assert.equal(reads,0);assert.equal(downloads,0)
})

const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{jsPDF}=require('jspdf')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const terms={schemaVersion:1,depositPercent:'25.00',basisTotal:'100.00',balanceDaysBefore:3,referenceStartsAt:'2027-01-10T16:00:00.000Z',referenceTimezone:'America/Guatemala',currencyCode:'GTQ'}
test('quotation PDF carries the agreed deposit and a readable deadline without private payment history',()=>{
 let pdf;class Capture extends jsPDF{constructor(){super();this.save=()=>{pdf=Buffer.from(this.output('arraybuffer'))}}}
 const quote={id:'test',reference:'PAYMENT-QA',created_at:'2026-11-01T00:00:00Z',total:100,lines:[],event_payment_terms:terms,receipts:[{reference:'PRIVATE-RECEIPT'}]}
 loadReportModule('../quotes/documents/generateQuotePDF.ts',{jspdf:Capture,'@/services/api':{},'./api':{}}).generateQuotePDF(quote,{companyName:'Synthetic'})
 const extracted=spawnSync('pdftotext',['-','-'],{input:pdf});assert.equal(extracted.status,0)
 const text=extracted.stdout.toString();assert.match(text,/Anticipo/);assert.match(text,/25/);assert.match(text,/enero/);assert.doesNotMatch(text,/PRIVATE-RECEIPT/)
})
test('public portal context accepts only safe agreed condition fields',()=>{
 const {quoteContext}=loadReportModule('../../components/customer-pages/documentAdapters.ts')
 const context=quoteContext({status:'SENT',company_name:'Synthetic',is_final_consumer:true,total:'100',lines:[],eventPaymentTerms:{depositPercent:'25.00',depositRequired:'25.00',dueAt:'2027-01-07T16:00:00Z',referenceTimezone:'America/Guatemala',balanceDaysBefore:3,currencyCode:'GTQ',referenceStartsAt:'2027-01-10T16:00:00Z',paid:'PRIVATE'}})
 assert.equal(context.eventPaymentTerms.depositRequired,'25.00');assert.equal(context.eventPaymentTerms.paid,undefined)
})
test('DST preview never silently removes the agreed percent or calendar-day condition',()=>{
 const {eventPaymentTermsText}=loadReportModule('../../services/eventPaymentTerms.ts')
 const gap={...terms,referenceStartsAt:'2026-03-09T06:30:00Z',referenceTimezone:'America/New_York',balanceDaysBefore:1}
 const text=eventPaymentTermsText(gap)
 assert.match(text,/25/);assert.match(text,/1 día/);assert.match(text,/primera prestación/);assert.match(text,/America\/New_York/)
})
test('saved order PDF uses the authoritative server deadline across a DST gap',()=>{
 let pdf;class Capture extends jsPDF{constructor(){super();this.save=()=>{pdf=Buffer.from(this.output('arraybuffer'))}}}
 const input={...terms,referenceStartsAt:'2026-03-09T06:30:00Z',referenceTimezone:'America/New_York',balanceDaysBefore:1}
 const publicTerms={depositPercent:'25.00',depositRequired:'25.00',balanceDaysBefore:1,referenceStartsAt:input.referenceStartsAt,referenceTimezone:input.referenceTimezone,dueAt:'2026-03-08T07:30:00Z',currencyCode:'GTQ'}
 loadReportModule('../orders/documents/generateOrderPDF.ts',{jspdf:Capture,'@/services/api':{},'./api':{}}).generateOrderPDF({id:'o',reference:'DST',created_at:'2026-01-01T00:00:00Z',total:'100.00',lines:[],event_payment_terms:input,eventPaymentTerms:publicTerms},{companyName:'Synthetic'})
 const text=spawnSync('pdftotext',['-','-'],{input:pdf}).stdout.toString();assert.match(text,/Anticipo/);assert.match(text,/marzo/);assert.match(text,/3:30/)
})
test('sale normalization and detail retain agreed conditions separately from the accounting deadline',()=>{
 const publicTerms={depositPercent:'25.00',depositRequired:'25.00',balanceDaysBefore:3,referenceStartsAt:terms.referenceStartsAt,referenceTimezone:terms.referenceTimezone,dueAt:'2027-01-07T16:00:00Z',currencyCode:'GTQ'}
 const {normalizeRawSale}=loadReportModule('../sales/hooks/useSalesData.ts',{'@/hooks/useSales':{},'@/services/api':{},'./api':{}})
 const sale=normalizeRawSale({id:'s',sale_items:[],total:'100',date:'2026-01-01',eventPaymentTerms:{...publicTerms,paid:'PRIVATE'},due_date:'2027-02-01T00:00:00Z',status:{name:'Completada'}})
 assert.deepEqual(sale.eventPaymentTerms,publicTerms);assert.equal(sale.dueDate,'2027-02-01T00:00:00Z')
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const {SaleDetailContent}=loadReportModule('../sales/components/SaleDetailContent.tsx',{'@/services/api':{},'./api':{},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>false})},'@/context/useModules':{useModules:()=>({isEnabled:()=>false})}})
 const html=renderToStaticMarkup(React.createElement(SaleDetailContent,{sale,locale:'es-GT',currencyCode:'GTQ'}))
 assert.match(html,/Anticipo/);assert.match(html,/enero/);assert.match(html,/Vencimiento/);assert.doesNotMatch(html,/PRIVATE/)
})

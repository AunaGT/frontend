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

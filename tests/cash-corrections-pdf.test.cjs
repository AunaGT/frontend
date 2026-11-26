const test=require('node:test'),assert=require('node:assert/strict'),{jsPDF}=require('jspdf')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('the real correction PDF uses shared table styling and exports original and corrected amounts',async()=>{
  let saved,document
  const pdf=loadReportModule('../cash-closure/documents/correctionPdf.ts',{
    '@/services/api':{getApiBaseUrl:()=>'/isolated-qa'},
    jspdf:{__esModule:true,default:function(){document=new jsPDF();document.save=name=>{saved=name};return document}},
    '@/services/cashCorrectionService':{correctionStatus:{APPROVED:'Aprobada'},correctionAccountingStatus:{POSTED:'Contabilizada'}},
  })
  await pdf.downloadCorrectionPdf({id:'correction-1',closureNumber:123,sequence:1,status:'APPROVED',accountingStatus:'POSTED',currency:'GTQ',reason:'Conteo revisado',proposedByName:'Ana',proposedAt:'2026-11-20T16:00:00Z',accountingDate:'2026-11-20',decidedByName:'Carlos',decidedAt:'2026-11-20T17:00:00Z',decisionReason:'Evidencia verificada',entryNumber:'A-000001',cashDelta:'80.00',correctedDifference:'-20.00',lines:[{name:'Efectivo',originalExpected:'1000.00',previousActual:'900.00',correctedActual:'980.00',delta:'80.00'}]},'Empresa QA','es-GT','America/Guatemala')
  assert.match(saved,/correccion-arqueo-123/)
  const bytes=document.output();for(const value of ['900.00','980.00','80.00','A-000001','Conteo revisado'])assert.ok(bytes.includes(value),value)
  assert.equal(document.getNumberOfPages(),1)
})
test('the original PDF keeps original figures and only adds a correction reference',()=>{
  let document
  const {generateClosurePDF}=loadReportModule('../cash-closure/generatePDF.ts',{
    jspdf:{__esModule:true,default:function(){document=new jsPDF();document.save=()=>{};return document}},
    '@/services/api':{getApiBaseUrl:()=>'/isolated-qa'},
  })
  generateClosurePDF({id:'original',closure_number:123,date:'2026-11-20T16:00:00Z',start_date:'2026-11-20T14:00:00Z',end_date:'2026-11-20T16:00:00Z',cashier_name:'Ana',status:'Aprobado',theoretical_total:'1000.00',actual_total:'900.00',difference:'-100.00',difference_percentage:'-10.00',opening_float:'0',theoretical_sales:'1000.00',theoretical_returns:'0',total_transactions:1,total_customers:1,average_ticket:'1000',notes:'Conteo original',payment_breakdowns:[],denominations:[]},'Empresa QA','GTQ','es-GT',undefined,2)
  const bytes=document.output();assert.ok(bytes.includes('Cifras originales.'));assert.ok(bytes.includes('900.00'));assert.equal(bytes.includes('980.00'),false)
})

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {spawnSync}=require('node:child_process'),{jsPDF}=require('jspdf')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('conditions preview uses the existing parsed JSON API contract and abort signal',async()=>{
  const result={conditions:{qa:null}},signal=new AbortController().signal
  const api={apiFetch:async(url,options)=>{assert.equal(url,'/api/quotes/service-conditions');assert.equal(options.signal,signal);assert.deepEqual(JSON.parse(options.body),{productIds:['qa']});return result}}
  const service=loadReportModule('../../services/quoteService.ts',{'./api':api})
  assert.deepEqual(await service.previewQuoteServiceConditions(['qa'],signal),result)
})
test('quotation PDF presents frozen service conditions without internal data',()=>{
  let pdf
  class Capture extends jsPDF {constructor(){super();this.save=()=>{pdf=Buffer.from(this.output('arraybuffer'))}}}
  const conditions={version:1,schedulingStyle:'WORK',durationPolicy:'EDITABLE',durationMinutes:60,allowedVenueKinds:['HOME'],publicInstructions:'Acceso principal QA'}
  const quote={id:'qa',reference:'CONDITIONS-QA',created_at:'2026-10-13T12:00Z',total:100,lines:[{product_id:'p',item_name:'Servicio QA',item_kind:'SERVICE',qty:'1',unit_label:'Evento',unit_price:100,line_total:100,service_schedule_snapshot:conditions,internalNotes:'SECRETO_QA'}]}
  loadReportModule('../quotes/documents/generateQuotePDF.ts',{jspdf:Capture,'@/services/api':{},'./api':{}}).generateQuotePDF(quote,{companyName:'Empresa QA'})
  const extracted=spawnSync('pdftotext',['-','-'],{input:pdf})
  assert.equal(extracted.status,0)
  const text=extracted.stdout.toString()
  for(const expected of ['Acceso principal QA','60 min','A domicilio','disponibilidad']) assert.ok(text.includes(expected),expected)
  assert.ok(!text.includes('SECRETO_QA'))
  const out=path.resolve(__dirname,'../output/pdf/commercial-qa/quote-service-conditions.pdf')
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,pdf)
})

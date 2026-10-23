const test=require('node:test'),assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process')
const {jsPDF}=require('jspdf')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('real commercial PDFs and ticket keep the original service name, unit and quantity',async()=>{
  const outputs=[]
  class CapturedPdf extends jsPDF { constructor(...args){super(...args);this.save=()=>{outputs.push(Buffer.from(this.output('arraybuffer')));return this}} }
  const mocks={jspdf:CapturedPdf,'./api':{apiFetch(){throw Error('Unexpected network')}},'@/services/api':{apiFetch(){throw Error('Unexpected network')}}}
  const line={id:'line',product_id:'s',item_kind:'SERVICE',item_name:'Asesoria original',unit_label:'Hora',quantity_decimals:3,qty:'0.125',qty_fulfilled:'0.125',unit_price:100,price:100,line_total:12.5,net_total:12.5,product:{name:'Nombre editado'}}
  const doc={id:'doc',reference:'QA-001',created_at:'2026-10-10T12:00:00Z',date:'2026-10-10T12:00:00Z',customer:'Cliente QA',is_final_consumer:true,isFinalConsumer:true,total:12.5,subtotal:12.5,items:0,line_count:1,lines:[line],sale_items:[line],products:[{id:'s',name:line.item_name,qty:line.qty,unitLabel:'Hora',price:100}],payment_method:{name:'Efectivo'},status:{name:'Completada'}}
  for(const [file,fn] of [['../orders/documents/generateOrderPDF.ts','generateOrderPDF'],['../quotes/documents/generateQuotePDF.ts','generateQuotePDF'],['../sales/documents/generateSaleTicket.ts','generateSaleTicket']]){
    await loadReportModule(file,mocks)[fn](doc,{companyName:'Empresa QA',locale:'es-GT',currencyCode:'GTQ'})
    assert.ok(outputs.length,fn)
    const result=spawnSync('pdftotext',['-','-'],{input:outputs.pop()})
    assert.equal(result.status,0,fn)
    const text=result.stdout.toString()
    if(fn.startsWith('generateSale')){
      assert.match(text,/No constituye factura fiscal/)
      assert.doesNotMatch(text,/FACTURA|autorizado por SAT/)
    }
    for(const value of ['Asesoria original','Hora','0.125','12.50']) assert.ok(text.includes(value),`${fn}: ${value}`)
    assert.ok(!text.includes('Nombre editado'),fn)
  }
})

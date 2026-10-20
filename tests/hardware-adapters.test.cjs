const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('simulation does not touch peripherals or imply physical success',()=>{
 const {simulateDiagnostic}=loadReportModule('../config/hardware/adapters.ts')
 assert.deepEqual(simulateDiagnostic({kind:'DRAWER_SIMULATION'}),{mode:'SIMULATED',outcome:'SIMULATED',message:'Simulación terminada. No se envió ningún pulso ni se abrió la gaveta.'})
})
test('sample PDFs contain PRUEBA and dimensions/copies, never a fiscal or commercial document',async()=>{
 const {prepareDiagnosticPdf}=loadReportModule('../config/hardware/diagnosticPdf.ts')
 const previous=global.fetch
 global.fetch=async file=>{if(!String(file).startsWith('/fonts/'))throw Error('Unexpected request');const data=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public',file));return{ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}}
 try{
 for(const [kind,profile]of [['TICKET_SAMPLE',{widthMm:80,heightMm:160,copies:2}],['LABEL_SAMPLE',{widthMm:60,heightMm:40,copies:1}],['OFFICE_SAMPLE',{widthMm:210,heightMm:297,copies:1}]]){
   const blob=await prepareDiagnosticPdf(kind,profile),text=Buffer.from(await blob.arrayBuffer()).toString('latin1')
   assert.match(text,/PRUEBA/);assert.match(text,/\/FontFile2/);assert.match(text,kind==='TICKET_SAMPLE'?/\/Count 2/:/\/Count 1/);assert.doesNotMatch(text,/Cliente|Factura|Venta registrada/)
 }
 await assert.rejects(prepareDiagnosticPdf('LABEL_SAMPLE',{widthMm:9,copies:101}))
 }finally{global.fetch=previous}
})
test('barcode submission is bound to the field and configured suffix, never global keystrokes',()=>{
 const {shouldSubmitScan}=loadReportModule('../../services/scannerService.ts',{'@/services/api':{}})
 for(const [key,suffix,expected]of [['Enter','ENTER',true],['Tab','TAB',true],['Enter','TAB',false],['Tab','NONE',false],['1','ENTER',false]])assert.equal(shouldSubmitScan({key,target:{tagName:'INPUT',type:'text',id:'scan-code'},currentTarget:{id:'scan-code'}},suffix),expected)
 assert.equal(shouldSubmitScan({key:'Enter',target:{tagName:'INPUT',type:'password',id:'secret'},currentTarget:{id:'scan-code'}},'ENTER'),false)
})

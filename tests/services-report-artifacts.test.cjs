const test=require('node:test'),assert=require('node:assert/strict'),XLSX=require('xlsx')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {makeReport}=require('./fixtures/reportFixtures.cjs')
test('quantity precision survives report preview, CSV and numeric Excel cells',async()=>{
  const model=loadReportModule('reportModel.ts'),report=makeReport('sales',{rows:0})
  report.sections=[{id:'service',title:'Servicios',columns:[{id:'name',label:'Servicio',type:'text',align:'left'},{id:'qty',label:'Cantidad',type:'decimal',align:'right',quantityDecimals:3},{id:'unit',label:'Unidad',type:'text',align:'left'},{id:'total',label:'Total',type:'money',align:'right'}],rows:[{name:'Asesoría',qty:'0.125',unit:'Hora',total:12.50}],totals:null}]
  report.charts=[]
  const parsed=model.preparedReportSchema.parse(report)
  assert.equal(model.formatReportCell('0.125',parsed.sections[0].columns[1],report),'0.125')
  const {generateReportWorkbook,generateReportCsv}=loadReportModule('documents/reportSpreadsheet.ts')
  assert.match(generateReportCsv(parsed,'service'),/0.125/)
  const workbook=XLSX.read(await generateReportWorkbook(parsed),{type:'array',cellNF:true})
  const cell=workbook.Sheets[workbook.SheetNames[1]].B6
  assert.equal(cell.t,'n');assert.equal(cell.v,.125);assert.equal(cell.z,'#,##0.###')
  const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),originalFetch=global.fetch
  try {
    global.fetch=async url=>new Response(fs.readFileSync(path.resolve(__dirname,'../public',String(url).replace(/^\//,''))))
    const {generateReportPdf}=loadReportModule('documents/reportPdf.ts')
    const pdf=Buffer.from(await (await generateReportPdf(parsed)).arrayBuffer())
    const result=spawnSync('pdftotext',['-','-'],{input:pdf})
    assert.equal(result.status,0)
    for(const value of ['0.125','Hora','12.50']) assert.ok(result.stdout.toString().includes(value),value)
  } finally {global.fetch=originalFetch}
})

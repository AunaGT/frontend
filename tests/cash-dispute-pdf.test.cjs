const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const dispute={id:'d1',eventId:'e1',branchId:'b1',customerName:'Comercial El Sol, S.A.',providerReference:'VISA-CB-2201',reason:'El cliente desconoce el cargo del 2 de octubre.',deadline:'2026-11-30',status:'LOST',version:7,
 claimed:'100.00',withdrawn:'100.00',recovered:'30.00',won:'0.00',lost:'100.00',charged:'60.00',customerCredit:'0.00',disposed:'100.00',unresolved:'0.00',fees:'5.00',currencyCode:'GTQ',createdAt:'2026-11-03T16:00:00Z',createdByName:'Ana López',
 replacesCaseId:null,replacedByCaseId:null,can:{read:true,manage:false,movements:false,resolve:false,charge:false},
 history:[{id:'h1',kind:'BANK_DEBIT',principal:'100.00',fee:'5.00',reference:'BANCO-0091',actor_name:'Ana López',created_at:'2026-11-04T15:00:00Z',accounting_status:'POSTED',economic_on:'2026-11-04',accounting_on:'2026-11-04',payload:{}},
  {id:'h2',kind:'BANK_RECOVERY',principal:'30.00',fee:'0.00',reference:'BANCO-0123',actor_name:'Ana López',created_at:'2026-11-20T15:00:00Z',accounting_status:'DEFERRED',economic_on:'2026-11-20',accounting_on:null,payload:{}},
  {id:'h3',kind:'COMMUNICATION',principal:'0',fee:'0',reference:null,actor_name:'Ana López',created_at:'2026-11-03T16:00:00Z',accounting_status:'ZERO',economic_on:null,accounting_on:null,payload:{}}],
 proposals:[{id:'p1',kind:'DISPOSITION',status:'APPROVED',payload:{reason:'Reparto acordado con el cliente'},expected_version:5,preview_key:'k',proposed_by_name:'Ana López',proposed_at:'2026-11-10T15:00:00Z',decided_by_name:'Marta Pérez',decided_at:'2026-11-11T15:00:00Z',decision_reason:null}]}
test('the dispute PDF lists origin, money dimensions, movements with accounting state and the reviewers, without calling itself an invoice',()=>{
 const {buildDisputePdf}=loadReportModule('../cash-closure/documents/disputePdf.ts',{'@/services/api':{getApiBaseUrl:()=>'',getAuthToken:()=>null}})
 const buffer=Buffer.from(buildDisputePdf(dispute,{companyName:'Empresa QA',locale:'es-GT',timezone:'America/Guatemala'}).output('arraybuffer'))
 assert.equal(buffer.subarray(0,5).toString(),'%PDF-')
 const out=path.resolve(__dirname,'../output/qa/cash-disputes');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'expediente.pdf'),buffer)
 const text=spawnSync('pdftotext',['-layout','-','-'],{input:buffer});assert.equal(text.status,0)
 const content=text.stdout.toString()
 for(const expected of ['EXPEDIENTE DE DISPUTA','VISA-CB-2201','Comercial El Sol','Perdida','Retirado por el proveedor','Recuperado','Cargo al cliente','Retiro del banco','Recuperación bancaria','Contabilizado','Pendiente de contabilizar','Resolución de la','Marta Pérez','4/11/2026','Empresa QA','Página 1 de 1'])assert.ok(content.includes(expected),expected)
 assert.match(content,/No es una factura/);assert.doesNotMatch(content,/FACTURA\b/)
 assert.ok(!content.includes('Actualización del expediente'),'non-money history is not listed as a movement')
})

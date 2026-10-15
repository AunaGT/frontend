const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process')
const { jsPDF } = require('jspdf')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

function capture(file, fn, args) {
  let pdf
  class CapturedPdf extends jsPDF {
    constructor(...options) { super(...options); this.save = () => { pdf = Buffer.from(this.output('arraybuffer')); return this } }
  }
  loadReportModule(file, { jspdf: CapturedPdf, './api': { apiFetch() { throw Error('Unexpected network') } }, '@/services/api': { apiFetch() { throw Error('Unexpected network') } } })[fn](...args)
  assert.ok(pdf, 'download contains an actual PDF')
  const result = spawnSync('pdftotext', ['-', '-'], { input: pdf })
  assert.equal(result.status, 0)
  const text = result.stdout.toString()
  assert.ok(text.includes('Empresa QA'))
  assert.match(text, /Página 1 de \d+/)
  fs.mkdirSync(path.resolve(__dirname, '../output/module-exports'), { recursive: true })
  fs.writeFileSync(path.resolve(__dirname, `../output/module-exports/${fn}.pdf`), pdf)
  return text
}

test('contact export keeps last product and readable basic data across numbered pages', () => {
  const supplier = { name: 'Contacto QA', party_type: 'SUPPLIER', contact: 'Ana QA', phone: '5555-1234', email: 'qa@example.test', address: 'Dirección '.repeat(18), categoriesLabel: 'Categoría QA', estado: 1, paymentTerms: '30 días', lastOrder: '01/10/2026', totalPurchases: 125.50,
    productsList: Array.from({ length: 70 }, (_, i) => ({ name: `Producto QA ${i + 1}`, stock: i, price: 12.5 })) }
  const text = capture('../contacts/components/generateSupplierPDF.ts', 'generateSupplierPDF', [supplier, { companyName: 'Empresa QA' }])
  for (const value of ['Contacto QA', 'Ana QA', '5555-1234', 'qa@example.test', 'Categoría QA', '125.50', 'Producto QA 70']) assert.ok(text.includes(value), value)
})

test('employee export retains identity and supplementary information with numbered pages', () => {
  const employee = { first_name: 'Ana', last_name: 'QA', code: 'EMP-QA', status: 'ACTIVO', hire_date: '2026-01-01', base_salary: 3500, bonificacion_incentivo: 250, pay_frequency: 'MENSUAL', payment_method: 'EFECTIVO', position: 'Asesora', work_schedule: 'Jornada QA' }
  const text = capture('../hr/pages/generateEmployeePDF.ts', 'generateEmployeePDF', [[employee], 'Empresa QA'])
  for (const value of ['EMP-QA', 'Ana QA', '3500.00', '250.00', 'Jornada QA']) assert.ok(text.includes(value), value)
})

test('cash closure export preserves counted amounts and signatures after long notes', () => {
  const closure = { closure_number: 'QA-101', date: '2026-10-11', start_date: '2026-10-10', end_date: '2026-10-11', cashier_name: 'Cajero QA', supervisor_name: 'Supervisor QA', theoretical_total: 125.50, theoretical_sales: 125.50, theoretical_returns: 0, actual_total: 125.50, difference: 0, difference_percentage: 0, total_transactions: 1, total_customers: 1, average_ticket: 125.50, denominations: [], payment_breakdowns: [], notes: 'Nota del cierre '.repeat(250) + 'ULTIMA_NOTA_QA' }
  const text = capture('../cash-closure/generatePDF.ts', 'generateClosurePDF', [closure, 'Empresa QA', 'GTQ', 'es-GT'])
  for (const value of ['125.50', 'QA-101', 'Cajero QA', 'Supervisor QA', 'ULTIMA_NOTA_QA', 'FIRMAS']) assert.ok(text.includes(value), value)
})

test('receivables statement and receipt preserve balances and allocations', () => {
  const customer = { name: 'Cliente QA', tax_id: 'QA-123', address: 'Dirección QA', credit_limit: 500 }
  const resumen = { saldo: 125.50, vencido: 0, credito_disponible: 0, disponible: 374.50 }
  const statement = capture('../receivables/pages/generateReceivablesPDF.ts', 'generateStatementPDF', [{ customer, resumen, ventas: [{ id: 'sale', reference: 'VENTA-QA', date: '2026-10-11', total: 150, abonado: 24.50, saldo: 125.50, payment_status: 'PARTIAL' }], cobros: [] }, { companyName: 'Empresa QA' }])
  for (const value of ['125.50', '24.50', 'VENTA-QA']) assert.ok(statement.includes(value), value)
  const receipt = capture('../receivables/pages/generateReceivablesPDF.ts', 'generateReceiptPDF', [{ id: 'QA-COBRO-1', kind: 'PAYMENT', customer, resumen, paid_at: '2026-10-11', amount: 24.50, no_aplicado: 0, aplicaciones: [{ reference: 'VENTA-QA', date: '2026-10-11', total: 150, amount: 24.50 }], notes: 'Nota del recibo QA' }, { companyName: 'Empresa QA' }])
  for (const value of ['125.50', '24.50', 'VENTA-QA', 'Nota del recibo QA']) assert.ok(receipt.includes(value), value)
})
test('an advance receipt distinguishes reserved, refunded and free money instead of calling the whole amount free credit',()=>{
  const text=capture('../receivables/pages/generateReceivablesPDF.ts','generateReceiptPDF',[{id:'ADVANCE-QA',kind:'PAYMENT',customer:{name:'Cliente QA'},resumen:{saldo:90},paid_at:'2026-10-13',amount:40,no_aplicado:0,comprometido:35,devuelto:5,aplicaciones:[]},{companyName:'Empresa QA'}])
  assert.match(text,/Comprometido con contrataciones/);assert.match(text,/35.00/);assert.match(text,/Devuelto/);assert.match(text,/5.00/)
  assert.doesNotMatch(text,/queda como saldo a favor/i)
})

test('promotion coupons retain all selected codes and use company branding on numbered print sheets', async () => {
  const previous=global.fetch
  global.fetch=async url=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(path.join(__dirname,'../public',url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}})
  const {buildCouponPdf}=loadReportModule('../promotions/coupons/couponPdf.ts')
  const {createDefaultCouponDesign}=loadReportModule('../promotions/coupons/couponDesign.ts')
  const design=createDefaultCouponDesign();design.terms='Condiciones QA'
  let pdf
  try{pdf=Buffer.from(await (await buildCouponPdf({design,codes:Array.from({length:5},(_,i)=>({code:`CUPON-QA-${i+1}`,active:true})),promotion:{name:'Promo QA',type:{name:'PERCENTAGE'},discount_percentage:10},branding:{companyName:'Empresa QA',locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'},assets:new Map()})).arrayBuffer())}finally{global.fetch=previous}
  const result=spawnSync('pdftotext',['-','-'],{input:pdf});assert.equal(result.status,0);const text=result.stdout.toString()
  for (const value of ['CUPON-QA-1', 'CUPON-QA-5', '10%', 'Condiciones QA']) assert.ok(text.includes(value), value)
  assert.ok(!text.includes('LOGO DE LA EMPRESA'))
})

test('coupon scene rejects long terms that would cross a cut rather than silently truncate them', () => {
  const {createDefaultCouponDesign}=loadReportModule('../promotions/coupons/couponDesign.ts')
  const {couponData,prepareCouponScene}=loadReportModule('../promotions/coupons/couponPresentation.ts')
  const design=createDefaultCouponDesign();design.terms='CondicionesFinalQA '.repeat(20)
  const scene=prepareCouponScene(design,couponData({name:'Promoción QA'},{code:'REAL'},{companyName:'Empresa QA',locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'}),(text,s)=>text.length*s.fontSize*.5)
  assert.ok(scene.issues.some(i=>i.elementId==='field-terms'&&i.code==='TEXT_OVERFLOW'))
})

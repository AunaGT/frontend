const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { spawnSync } = require('node:child_process'), { jsPDF } = require('jspdf')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const cases = [
  ['sales', 'generateSaleInvoicePDF', 'Comprobante-interno-QA-001.pdf'],
  ['quotes', 'generateQuotePDF', 'cotizacion-QA-001.pdf'],
  ['orders', 'generateOrderPDF', 'pedido-QA-001.pdf'],
  ['transfers', 'generateTransferPDF', 'traslado-QA-001.pdf'],
]
function fixture(count = 2) {
  const lines = Array.from({ length: count }, (_, i) => ({ id: String(i), product_id: 'p', item_name: `ArticuloQA${i + 1}`, qty: '0.125', qty_fulfilled: '0.125', unit_label: 'Hora', unit_price: 100, line_total: 12.5, qty_sent: '0.125', qty_received: '0.125', product: { name: `ArticuloQA${i + 1}`, barcode: `COD${i + 1}` } }))
  return { id: 'doc', reference: 'QA-001', created_at: '2026-10-10T12:00:00Z', date: '2026-10-10T12:00:00Z', sent_at: '2026-10-10T12:00:00Z', customer: 'Cliente QA', customer_nit: '1234', customerNit: '1234', total: 25, subtotal: 30, discount_total: 5, discountTotal: 5, payment: 'Efectivo', amountReceived: 50, change: 25, branch: { name: 'Principal' }, fromBranch: { name: 'Principal' }, toBranch: { name: 'Destino' }, status: 'RECIBIDA', lines, products: lines.map(l => ({ name: l.item_name, qty: l.qty, unitLabel: l.unit_label, price: l.unit_price })) }
}
function generate(module, fn, record, logoDataUrl) {
  let result
  class CapturedPdf extends jsPDF { constructor(...args) { super(...args); this.save = filename => { result = { filename, buffer: Buffer.from(this.output('arraybuffer')) }; return this } } }
  const mocks = { jspdf: CapturedPdf, '@/services/api': {}, './api': {} }
  loadReportModule(`../${module}/documents/${fn}.ts`, mocks)[fn](record, { companyName: 'EmpresaCentradaQA', logoDataUrl, locale: 'es-GT', currencyCode: 'GTQ' })
  return result
}
function extract(buffer, bbox = false) {
  const result = spawnSync('pdftotext', [...(bbox ? ['-bbox'] : []), '-', '-'], { input: buffer })
  assert.equal(result.status, 0)
  return result.stdout.toString()
}
test('commercial documents use centered company branding, navy tables and numbered footers while preserving amounts and names', () => {
  const out = path.resolve(__dirname, '../output/pdf/commercial-qa'); fs.mkdirSync(out, { recursive: true })
  for (const [module, fn, filename] of cases) {
    const { buffer, filename: saved } = generate(module, fn, fixture(), 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../public/auna/isotipo-192.png')).toString('base64'))
    assert.equal(saved, filename)
    const text = extract(buffer), xml = extract(buffer, true)
    for (const expected of ['ArticuloQA2', '0.125', 'Página 1 de 1']) assert.ok(text.includes(expected), `${fn}: ${expected}`)
    if (module !== 'transfers') for (const expected of ['12.50', '25.00']) assert.ok(text.includes(expected), `${fn}: ${expected}`)
    const company = xml.match(/<word xMin="([\d.]+)"[^>]*xMax="([\d.]+)"[^>]*>EmpresaCentradaQA<\/word>/)
    assert.ok(company && Math.abs((Number(company[1]) + Number(company[2])) / 2 - 297.64) < 2)
    assert.match(buffer.toString('latin1'), /0\.05 0\.13 0\.23 rg/)
    fs.writeFileSync(path.join(out, filename), buffer)
  }
})
test('long customers, final totals and multipage notes stay inside printable content without losing the final word', () => {
  for (const [module, fn] of cases) {
    const record = fixture(60)
    record.customer = 'ClienteExtenso '.repeat(90) + 'UltimoClienteQA'
    record.notes = 'NotaExtensa '.repeat(1400) + 'UltimaNotaQA'
    record.fromBranch.name = 'SucursalExtensa '.repeat(35) + 'UltimoOrigenQA'
    record.toBranch.name = 'DestinoExtenso '.repeat(35) + 'UltimoDestinoQA'
    const { buffer } = generate(module, fn, record), xml = extract(buffer, true), text = extract(buffer)
    fs.writeFileSync(path.resolve(__dirname, `../output/pdf/commercial-qa/${module}-long.pdf`), buffer)
    for (const expected of ['ArticuloQA60', module === 'transfers' ? 'UltimoOrigenQA' : 'UltimoClienteQA']) assert.ok(text.includes(expected), `${fn}: ${expected}`)
    if (module !== 'sales') assert.ok(text.includes('UltimaNotaQA'), fn)
    const pages = xml.split('<page').slice(1)
    assert.ok(pages.length > 1, fn)
    pages.forEach((page, i) => {
      assert.match(page, new RegExp(`>P.gina<`), `${fn} footer page ${i + 1}`)
      assert.ok(text.includes(`Página ${i + 1} de ${pages.length}`), fn)
      for (const match of page.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)<\/word>/g)) {
        if (Number(match[2]) > 800 && Number(match[4]) < 825) continue // Reserved footer band.
        assert.ok(Number(match[1]) >= 38 && Number(match[3]) <= 558, `${fn}: horizontal overflow ${match[5]}`)
        assert.ok(Number(match[4]) < 789, `${fn}: content collided with footer ${match[5]}`)
      }
    })
  }
})
test('invoice keeps discounts, returns, credit balance, deadline and SAT authorization after a multipage table', () => {
  const record = { ...fixture(101), hasReturns: true, totalReturned: 2, adjustedTotal: 23, isCredit: true, creditPaid: 8, creditBalance: 15, dueDate: '2026-11-10T12:00:00Z', sale_dtes: [{ authorization: 'SAT-AUTHORIZATION-QA' }] }
  const text = extract(generate('sales', 'generateSaleInvoicePDF', record).buffer)
  for (const expected of ['ArticuloQA101', '30.00', '5.00', '2.00', 'Total neto:', '23.00', 'Monto recibido:', '50.00', 'Vuelto:', '25.00', 'Venta a crédito', '8.00', '15.00', 'Vencimiento:', 'SAT-AUTHORIZATION-QA']) assert.ok(text.includes(expected), expected)
})

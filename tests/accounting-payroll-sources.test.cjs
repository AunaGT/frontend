const test = require('node:test')
const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

for (const [source, label] of [['PAYROLL', 'Nómina'], ['PAYROLL_PAYMENT', 'Pago de nómina'], ['PAYROLL_ADVANCE', 'Anticipo de nómina']]) {
  test(`journal Excel identifies ${source} without changing amounts`, async context => {
    let bytes
    const document = global.document
    context.mock.method(URL, 'createObjectURL', blob => { bytes = blob.arrayBuffer(); return 'blob:test' })
    context.mock.method(URL, 'revokeObjectURL', () => {})
    context.mock.method(global, 'setTimeout', () => 0)
    global.document = { body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) }
    try {
    const { exportJournal } = loadReportModule('../accounting/components/exportExcel.ts')
    await exportJournal([{ entry_number: 'A-001', date: '2026-10-07T18:00:00Z', description: 'Planilla de prueba', branch: null, source_type: source, lines: [
      { account_id: 1, account: { code: '2107', name: 'Sueldos por pagar' }, debit: '25.00', credit: '0' },
      { account_id: 2, account: { code: '1102', name: 'Bancos' }, debit: '0', credit: '25.00' },
    ] }], { source }, 'prueba.xlsx')
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await bytes)
    const sheet = workbook.getWorksheet('Diario')
    assert.equal(sheet.getCell('A3').value, `Todos los movimientos · Origen: ${label}`)
    assert.equal(sheet.getCell('E6').value, label)
    assert.equal(sheet.getCell('E7').value, null, 'Continuation lines do not repeat the origin')
    assert.deepEqual(['F9', 'G9', 'H9'].map(address => sheet.getCell(address).value), ['Totales', 25, 25])
    } finally { global.document = document }
  })
}

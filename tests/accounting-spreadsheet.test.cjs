const test = require('node:test'), assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const branding = { companyName: 'Depósito El Roble', scopeLabel: 'Sucursal Central' }
const filters = { from: '2026-01-01', to: '2026-10-01' }

async function workbook(run) {
  let bytes, filename
  const original = { document: global.document, createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL, setTimeout: global.setTimeout }
  URL.createObjectURL = blob => { bytes = blob.arrayBuffer(); return 'blob:accounting-test' }
  URL.revokeObjectURL = () => {}
  global.setTimeout = () => 0
  global.document = { body: { appendChild() {} }, createElement: () => ({ click() { filename = this.download }, remove() {} }) }
  try {
    const exports = loadReportModule('../accounting/components/exportExcel.ts')
    await run(exports)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await bytes)
    return { wb, filename }
  } finally {
    global.document = original.document; URL.createObjectURL = original.createObjectURL
    URL.revokeObjectURL = original.revokeObjectURL; global.setTimeout = original.setTimeout
  }
}

function tableStyle(ws, filter) {
  assert.equal(ws.getCell('A2').value, 'Depósito El Roble')
  assert.equal(ws.getCell('A1').font.name, 'Calibri')
  assert.equal(ws.getCell('A1').fill.fgColor.argb, 'FF112844')
  assert.equal(ws.getCell('A5').fill.fgColor.argb, 'FFFF6F00')
  assert.equal(ws.views[0].state, 'frozen'); assert.equal(ws.views[0].ySplit, 5)
  assert.equal(ws.autoFilter, filter)
  assert.equal(ws.pageSetup.fitToWidth, 1); assert.equal(ws.pageSetup.fitToHeight, 0)
  assert.equal(ws.pageSetup.printTitlesRow, '1:5')
  assert.equal(ws.getCell('A6').border.bottom.color.argb, 'FFD8E1EB')
  assert.notEqual(ws.getCell('A6').fill.fgColor.argb, ws.getCell('A7').fill.fgColor.argb)
}

test('journal XLSX keeps all entry lines, operative dates, cents and safe text within styled company headers', async () => {
  const entries = [{ entry_number: '0001', date: '2026-10-01T12:00:00Z', description: '=HYPERLINK("evil")', source_type: 'MANUAL', branch: { name: 'Central' }, lines: [
    { account_id: 1, account: { code: '1101', name: 'Caja' }, debit: '123.456', credit: '0' },
    { account_id: 2, account: { code: '2101', name: 'Capital' }, debit: '0', credit: '123.456' },
  ] }]
  const { wb, filename } = await workbook(exports => exports.exportJournal(entries, filters, 'diario-personal.xlsx', branding))
  const ws = wb.getWorksheet('Diario'); tableStyle(ws, 'A5:H7')
  assert.equal(filename, 'diario-personal.xlsx'); assert.equal(ws.getCell('A6').value, '0001')
  assert.ok(ws.getCell('B6').value instanceof Date); assert.equal(ws.getCell('B6').value.toISOString(), '2026-10-01T00:00:00.000Z')
  assert.equal(ws.getCell('B6').numFmt, 'dd/mm/yyyy'); assert.equal(ws.getCell('B7').value, null)
  assert.equal(ws.getCell('C6').value, '\'=HYPERLINK("evil")'); assert.equal(ws.getCell('C6').type, ExcelJS.ValueType.String)
  assert.equal(ws.getCell('G6').value, 123.46); assert.equal(ws.getCell('H7').value, 123.46)
  assert.equal(ws.getCell('G7').value, null); assert.equal(ws.getCell('G9').value, 123.46)
  assert.equal(ws.getCell('G6').numFmt, '"GTQ" #,##0.00;[Red]("GTQ" #,##0.00)')
  assert.equal(ws.getCell('G9').font.bold, true); assert.match(ws.getCell('A4').value, /Sucursal Central/)
})

test('journal and ledger dates preserve business days across midnight, month/year boundaries and date-only values', async () => {
  for (const [timezone, dates, expected] of [
    [undefined, ['2026-01-01T02:00:00Z', '2026-10-11T02:30:00Z', '2026-02-01T02:00:00Z', '2026-10-11T18:00:00Z', '2026-10-11'], ['2025-12-31', '2026-10-10', '2026-01-31', '2026-10-11', '2026-10-11']],
    ['Europe/Paris', ['2026-01-01T23:30:00Z', '2026-01-01'], ['2026-01-02', '2026-01-01']],
  ]) {
    const meta = { ...branding, ...(timezone ? { timezone } : {}) }
    const entries = dates.map((date, i) => ({ entry_number: String(i), date, description: 'Fecha del asiento', source_type: 'MANUAL', branch: null, lines: [{ account_id: 1, debit: '1', credit: '0' }] }))
    const journal = await workbook(exports => exports.exportJournal(entries, filters, undefined, meta))
    const ledger = await workbook(exports => exports.exportLedger({ account: { code: '1101', name: 'Caja' }, initialBalance: 0, finalBalance: dates.length, totals: { debit: dates.length, credit: 0 }, movements: dates.map((date, i) => ({ date, entry_number: String(i), description: 'Fecha del asiento', debit: 1, credit: 0, balance: i + 1 })) }, filters, undefined, meta))
    for (const [wb, name, column, firstRow] of [[journal.wb, 'Diario', 'B', 6], [ledger.wb, 'Mayor', 'A', 7]]) {
      expected.forEach((day, i) => {
        const cell = wb.getWorksheet(name).getCell(`${column}${firstRow + i}`)
        assert.ok(cell.value instanceof Date)
        assert.equal(cell.value.toISOString(), `${day}T00:00:00.000Z`)
        assert.equal(cell.numFmt, 'dd/mm/yyyy')
      })
    }
  }
})

test('ledger and trial balance keep balances, blank debit cells and numeric totals under filters', async () => {
  const account = { code: '001', name: 'Caja' }
  const ledger = { account, initialBalance: -3.25, finalBalance: 0, totals: { debit: 3.25, credit: 0 }, movements: [{ date: '2026-10-01T12:00:00Z', entry_number: '0002', description: '@peligro', debit: 3.25, credit: 0, balance: 0 }] }
  const { wb } = await workbook(exports => exports.exportLedger(ledger, filters, undefined, branding))
  const ws = wb.getWorksheet('Mayor'); tableStyle(ws, 'A5:F7')
  assert.equal(ws.getCell('A7').value.toISOString(), '2026-10-01T00:00:00.000Z'); assert.equal(ws.getCell('A7').numFmt, 'dd/mm/yyyy')
  assert.equal(ws.getCell('F6').value, -3.25); assert.equal(ws.getCell('F7').value, 0)
  assert.equal(ws.getCell('E7').value, null); assert.equal(ws.getCell('C7').value, "'@peligro")
  assert.equal(ws.getCell('D9').value, 3.25)
  const trial = { rows: [{ ...account, type: 'ASSET', initialBalance: -3.25, debit: 3.25, credit: 0, finalBalance: 0 }], totals: { debit: 3.25, credit: 0 } }
  const result = await workbook(exports => exports.exportTrialBalance(trial, filters, undefined, branding))
  const balance = result.wb.getWorksheet('Balanza'); tableStyle(balance, 'A5:G6')
  assert.equal(balance.getCell('A6').value, '001'); assert.equal(balance.getCell('G6').value, 0)
  assert.equal(balance.getCell('E8').value, 3.25); assert.equal(balance.getCell('F8').value, 0)
})

test('financial statements preserve both section layouts and style subtotals without treating them as tables', async () => {
  const pnl = { income: [{ code: '4101', name: 'Ventas', amount: 25.25 }], costs: [], expenses: [], totalIncome: 25.25, totalCosts: 0, grossProfit: 25.25, totalExpenses: 0, netIncome: 25.25 }
  const bs = { assets: [], liabilities: [], equity: [], currentResult: 25.25, totalAssets: 25.25, totalLiabilities: 0, totalEquity: 25.25 }
  const { wb } = await workbook(exports => exports.exportStatements(pnl, bs, { ...filters, asOf: '2026-10-01' }, undefined, branding))
  assert.deepEqual(wb.worksheets.map(ws => ws.name), ['Estado de Resultados', 'Balance General'])
  const ws = wb.worksheets[0], balance = wb.worksheets[1]
  assert.equal(ws.getCell('A2').value, 'Depósito El Roble'); assert.equal(ws.getCell('A5').value, 'Ingresos')
  assert.equal(ws.getCell('B6').value, 25.25); assert.equal(ws.getCell('B7').value, 25.25)
  assert.equal(ws.getCell('B7').font.bold, true); assert.equal(ws.getCell('A9').fill.fgColor.argb, 'FFFF6F00')
  assert.equal(ws.getCell('B16').value, 25.25); assert.equal(ws.autoFilter, undefined)
  assert.equal(balance.getCell('B15').value, 25.25); assert.match(balance.getCell('A4').value, /Toda la empresa/)
})

test('tax XLSX retains regime detail, every original column, zeros and negative credits', async () => {
  for (const regime of ['GENERAL', 'PEQUENO']) {
    const totals = { netSales: 100, ivaDebit: 12, ivaCredit: 15, pequenoTax: 5, toPay: -3 }
    const { wb } = await workbook(exports => exports.exportTaxes({ year: 2026, regime, ivaRate: .12, pequenoRate: .05, months: [{ month: 1, ...totals }, { month: 2, netSales: 0, ivaDebit: 0, ivaCredit: 0, pequenoTax: 0, toPay: 0 }], totals }, undefined, branding))
    const ws = wb.getWorksheet('Impuestos'); tableStyle(ws, 'A5:F7')
    assert.equal(ws.getCell('F6').value, -3); assert.equal(ws.getCell('F7').value, 0)
    assert.equal(ws.getCell('E5').value, 'IVA pequeño contribuyente'); assert.equal(ws.getCell('F9').value, -3)
    assert.match(ws.getCell('A3').value, regime === 'GENERAL' ? /IVA 12%/ : /tarifa 5%/)
  }
})

test('accounting dialogs await download failures and pass the active company without closing early', async () => {
  const React = require('react')
  const ledger = { account: { code: '001', name: 'Caja' }, movements: [], totals: { debit: 0, credit: 0 }, initialBalance: 0, finalBalance: 0 }
  const trial = { rows: [], totals: { debit: 0, credit: 0 } }
  const pnl = { income: [], costs: [], expenses: [] }, bs = { assets: [], liabilities: [], equity: [] }
  const taxes = { year: 2026, months: [], totals: {} }
  const cases = [
    ['JournalTab', 'exportJournal', [[], false, 1, 1, 1, '', '', '', '', null, false, false, false, false, true, false], { accounts: [], canCreate: false }],
    ['LedgerTab', 'exportLedger', ['1', '', '', ledger, false, true, false, 0], { accounts: [] }],
    ['TrialBalanceTab', 'exportTrialBalance', ['', '', trial, false, true, false, 0], {}],
    ['StatementsTab', 'exportStatements', ['', null, '', '', '', true, pnl, bs, false, false, 0], {}],
    ['TaxesTab', 'exportTaxes', [2026, taxes, false, true, 0], {}],
  ]
  for (const [name, exportName, states, props] of cases) {
    for (const fail of [false, true]) {
      let index = 0, settle, args
      const nodes = [], changes = [], toasts = []
      const { [name]: Component } = loadReportModule(`../accounting/components/${name}.tsx`, {
        react: { ...React, useEffect() {}, useCallback: callback => callback, useState(initial) { const key = index++; return [key < states.length ? states[key] : initial, value => changes.push({ key, value })] } },
        '@/context/useTenant': { useTenant: () => ({ company: { id: 'active-company', name: 'Depósito El Roble' }, branches: [] }) },
        '@/hooks/use-toast': { useToast: () => ({ toast: value => toasts.push(value) }) },
        '@/hooks/useSystemSettings': { useSystemSettings: () => ({ timezone: 'Europe/Paris' }) },
        'react-router-dom': { useNavigate: () => () => {} },
        '@/services/accountingService': { getJournal: async () => ({ items: [{ lines: [] }], totalPages: 1 }) },
        './exportExcel': { [exportName]: (...values) => { args = values; return new Promise((resolve, reject) => { settle = () => fail ? reject(new Error('No se pudo generar Excel')) : resolve() }) } },
      }, nodes)
      Component(props)
      const dialog = nodes.find(node => node.props.title === ({ JournalTab: 'Exportar libro diario', LedgerTab: 'Exportar libro mayor', TrialBalanceTab: 'Exportar balanza de comprobación', StatementsTab: 'Exportar estados financieros', TaxesTab: 'Exportar reporte de impuestos' })[name])
      const pending = dialog.props.onExport({ fileName: 'elegido.xlsx', format: 'xlsx' })
      assert.ok(pending instanceof Promise, `${name} must await the workbook download`)
      await Promise.resolve()
      assert.equal(args.at(-1).companyName, 'Depósito El Roble')
      if (name === 'JournalTab' || name === 'LedgerTab') assert.equal(args.at(-1).timezone, 'Europe/Paris')
      assert.equal(changes.at(-1).value, true)
      assert.ok(!changes.some(change => change.value === false), 'Dialog must stay open while downloading')
      settle(); await pending
      assert.equal(changes.at(-1).value, false)
      assert.equal(toasts.length, fail || name === 'JournalTab' ? 1 : 0)
      if (fail) assert.equal(changes.filter(change => change.value === false).length, 1, 'Only pending ends on failure; dialog stays open')
    }
  }
})

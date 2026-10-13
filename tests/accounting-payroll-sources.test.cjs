const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const XLSX = require('xlsx')
const componentDir = path.resolve(__dirname, '../src/modules/accounting/components')

// Keep workbook generation real; intercept only the file download.
function load(name, workbookSink) {
  const file = path.join(componentDir, name + '.ts')
  const mod = new Module(file, module)
  mod.paths = Module._nodeModulePaths(componentDir)
  const nativeRequire = mod.require.bind(mod)
  mod.require = dependency => dependency === './format' ? load('format', workbookSink) : dependency === 'xlsx' ? { ...XLSX, writeFile: workbookSink } : nativeRequire(dependency)
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file)
  return mod.exports
}

for (const [source, label] of [['PAYROLL', 'Nómina'], ['PAYROLL_PAYMENT', 'Pago de nómina'], ['PAYROLL_ADVANCE', 'Anticipo de nómina']]) {
  test(`journal Excel identifies ${source} without changing amounts`, () => {
    let workbook
    const { exportJournal } = load('exportExcel', wb => { workbook = wb })
    exportJournal([{ entry_number: 'A-001', date: '2026-10-07T18:00:00Z', description: 'Planilla de prueba', branch: null, source_type: source, lines: [
      { account_id: 1, account: { code: '2107', name: 'Sueldos por pagar' }, debit: '25.00', credit: '0' },
      { account_id: 2, account: { code: '1102', name: 'Bancos' }, debit: '0', credit: '25.00' },
    ] }], { source }, 'prueba.xlsx')
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Diario, { header: 1, defval: null })
    assert.equal(rows[1][0], `Todos los movimientos · Origen: ${label}`)
    assert.equal(rows[4][4], label)
    assert.equal(rows[5][4], null, 'Continuation lines do not repeat the origin')
    assert.deepEqual(rows.at(-1).slice(5), ['Totales', 25, 25])
  })
}

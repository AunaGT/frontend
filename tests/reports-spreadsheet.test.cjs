const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), XLSX = require('xlsx')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { fixture } = require('./fixtures/reportFixtures.cjs')
test('Excel has operative numbers, local dates, correct percentages, text identifiers, filters and frozen headers', async () => {
  const { generateReportWorkbook } = loadReportModule('documents/reportSpreadsheet.ts'), ExcelJS = require('exceljs'), report = fixture('products', 301)
  report.sections[0].rows[0].net = null; report.sections[0].rows[1].net = 0
  const bytes = await generateReportWorkbook(report), wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes)
  assert.equal(wb.worksheets[0].name, 'Resumen'); const ws = wb.worksheets[1]
  assert.equal(ws.views[0].state, 'frozen'); assert.equal(ws.views[0].ySplit, 5); assert.ok(ws.autoFilter)
  assert.equal(ws.getCell('A6').value, '00001'); assert.equal(ws.getCell('C6').value, null); assert.equal(ws.getCell('C7').value, 0)
  assert.equal(ws.getCell('D6').value, .285); assert.equal(ws.getCell('D6').numFmt, '0.0%')
  assert.equal(ws.getCell('E6').value.toISOString(), '2026-09-30T19:00:00.000Z')
  assert.match(ws.getCell('B306').value, /QA-0301/); assert.equal(ws.getCell('C307').value, 301)
  const independent = XLSX.read(bytes, { type: 'array', cellDates: true }); assert.equal(independent.Sheets.Detalle.D6.v, .285); assert.equal(independent.Sheets.Detalle.A6.v, '00001')
  fs.mkdirSync(path.resolve(__dirname, '../output/reports-qa'), { recursive: true }); fs.writeFileSync(path.resolve(__dirname, '../output/reports-qa/products-301.xlsx'), Buffer.from(bytes))
})
test('sheet names are sanitized and unique without losing sections', async () => {
  const { generateReportWorkbook } = loadReportModule('documents/reportSpreadsheet.ts'), report = fixture()
  report.sections = ['Resumen', 'Resumen', '[]:*?/\\' + 'x'.repeat(60), '[]:*?/\\' + 'x'.repeat(60)].map((title, i) => ({ ...report.sections[0], id: String(i), title }))
  const wb = XLSX.read(await generateReportWorkbook(report), { type: 'array' }); assert.equal(new Set(wb.SheetNames).size, 5); assert.ok(wb.SheetNames.every(s => s.length <= 31 && !/[\[\]:*?/\\]/.test(s)))
})
test('CSV neutralizes formulas in strings, preserves numeric negatives, quotes and Unicode', () => {
  const { generateReportCsv } = loadReportModule('documents/reportSpreadsheet.ts'), report = fixture('sales', 0)
  const values = ['=SUM(1,1)', '  =1+1', '\t@SUM(1,1)', '\r+1', '-texto', 'café, "piñón"\r\nsegunda línea']
  report.sections[0].rows = values.map(name => ({ name, net: -2 }))
  report.sections[0].columns = report.sections[0].columns.filter(c => ['name', 'net'].includes(c.id))
  const csv = generateReportCsv(report, 'detail'); assert.equal(csv.charCodeAt(0), 0xFEFF)
  const sheet = XLSX.read(csv.slice(1), { type: 'string', raw: true }).Sheets.Sheet1, rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true })
  assert.deepEqual(rows[0], ['Descripción', 'Neto (GTQ)']); assert.equal(rows.length, 7)
  values.forEach((v, i) => { assert.equal(rows[i + 1][0], i < 5 ? "'" + v : v.replace(/\r\n/g, '\n')); assert.equal(rows[i + 1][1], '-2') })
  assert.ok(csv.includes('"café, ""piñón""\r\nsegunda línea"'), 'raw CSV preserves embedded CRLF')
  assert.throws(() => generateReportCsv(report, 'missing'))
})
test('thirteen normal and empty workbooks and CSVs preserve the same snapshot', async () => {
  const { generateReportWorkbook, generateReportCsv } = loadReportModule('documents/reportSpreadsheet.ts'), { REPORT_IDS } = loadReportModule('reportModel.ts')
  for (const id of REPORT_IDS) for (const count of [0, 2]) {
    const report = fixture(id, count), wb = XLSX.read(await generateReportWorkbook(report), { type: 'array' })
    assert.equal(wb.Sheets.Resumen.B6.v, count)
    assert.equal(generateReportCsv(report, 'detail').includes('QA-0002'), count > 0)
  }
})
test('total labels remain text when the first selected column is a date or money', async () => {
  const { makeReport } = require('./fixtures/reportFixtures.cjs'), { generateReportWorkbook } = loadReportModule('documents/reportSpreadsheet.ts')
  for (const id of ['merchandise', 'inventory-counts']) {
    const report = makeReport(id, { rows: 2 })
    if (id === 'inventory-counts') report.sections[0].columns = report.sections[0].columns.filter(c => ['createdAt', 'differenceValue'].includes(c.id))
    const wb = XLSX.read(await generateReportWorkbook(report), { type: 'array', cellDates: true }), sheet = wb.Sheets[wb.SheetNames[1]]
    assert.equal(sheet.A8.v, 'Total del reporte'); assert.equal(sheet.A8.t, 's')
  }
})

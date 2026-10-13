const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), XLSX = require('xlsx'), { spawnSync } = require('node:child_process')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { makeReport } = require('./fixtures/reportFixtures.cjs')
const originalFetch = global.fetch
test.before(() => { global.fetch = async url => new Response(fs.readFileSync(path.resolve(__dirname, '../public', String(url).replace(/^\//, '')))) })
test.after(() => { global.fetch = originalFetch })
test('frontend artifact fixtures remain usable without a sibling backend checkout', () => {
  const source = fs.readFileSync(path.resolve(__dirname, 'fixtures/reportFixtures.cjs'), 'utf8')
  assert.ok(!source.includes('deposito-backend'), 'capture real backend DTO fixtures locally instead of importing sibling production code in frontend tests')
})
test('actual thirteen backend builders export the same complete normal/empty sections to PDF, XLSX and CSV', async () => {
  const { REPORT_IDS, preparedReportSchema } = loadReportModule('reportModel.ts'), { generateReportPdf } = loadReportModule('documents/reportPdf.ts'), { generateReportWorkbook, generateReportCsv } = loadReportModule('documents/reportSpreadsheet.ts')
  const output = path.resolve(__dirname, '../output/reports-qa'); fs.mkdirSync(output, { recursive: true })
  for (const id of REPORT_IDS) for (const rows of [0, 6]) {
    const report = makeReport(id, { rows }); preparedReportSchema.parse(report)
    const pdf = Buffer.from(await (await generateReportPdf(report)).arrayBuffer()), bytes = await generateReportWorkbook(report), wb = XLSX.read(bytes, { type: 'array', cellDates: true })
    const extracted = spawnSync('pdftotext', ['-', '-'], { input: pdf }); assert.equal(extracted.status, 0, id); assert.ok(extracted.stdout.toString().includes(report.title), id)
    assert.equal(wb.SheetNames.length, report.sections.length + 1, id)
    report.sections.forEach((section, i) => { const sheet = wb.Sheets[wb.SheetNames[i + 1]], csv = generateReportCsv(report, section.id); assert.ok(sheet); assert.equal(csv.split('\r\n').length, section.rows.length + 2, id); if (section.rows.length) assert.ok(sheet.A6, id) })
    if (rows) { fs.writeFileSync(path.join(output, `${id}.pdf`), pdf); fs.writeFileSync(path.join(output, `${id}.xlsx`), Buffer.from(bytes)); fs.writeFileSync(path.join(output, `${id}.csv`), generateReportCsv(report, report.sections[0].id)) }
  }
})

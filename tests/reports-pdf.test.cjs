const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { spawnSync } = require('node:child_process')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { fixture } = require('./fixtures/reportFixtures.cjs')
const originalFetch = global.fetch
test.before(() => { global.fetch = async url => new Response(fs.readFileSync(path.resolve(__dirname, '../public', String(url).replace(/^\//, '')))) })
test.after(() => { global.fetch = originalFetch })
test('real PDF preserves last row, Unicode, totals and repeated page numbering across 301 rows', async () => {
  const { generateReportPdf } = loadReportModule('documents/reportPdf.ts'), report = fixture('inventory', 301)
  report.sections[0].rows[0].name = 'Łukasz · café · piñón\nTexto multilínea con información de prueba.'
  report.notes.push('Nota de prueba '.repeat(60))
  const blob = await generateReportPdf(report), buffer = Buffer.from(await blob.arrayBuffer())
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
  const text = spawnSync('pdftotext', ['-', '-'], { input: buffer }); assert.equal(text.status, 0)
  const content = text.stdout.toString()
  for (const expected of ['QA-0301', 'Łukasz', 'piñón', 'Empresa QA', 'Página 1 de', '301.00']) assert.ok(content.includes(expected), expected)
  for (const expected of ['Resumen', 'Período', 'Sucursal', 'Moneda', 'Preparado por']) assert.ok(content.includes(expected), expected)
  assert.ok(!content.includes('Auna ERP'))
  fs.mkdirSync(path.resolve(__dirname, '../output/reports-qa'), { recursive: true })
  fs.writeFileSync(path.resolve(__dirname, '../output/reports-qa/inventory-301.pdf'), buffer)
})
test('all thirteen reports generate readable normal and empty PDFs without requiring a logo', async () => {
  const { generateReportPdf } = loadReportModule('documents/reportPdf.ts'), { REPORT_IDS } = loadReportModule('reportModel.ts')
  for (const id of REPORT_IDS) for (const count of [0, 2]) {
    const report = fixture(id, count); report.summary[0].value = -123456789.25; report.branding.logoDataUrl = 'invalid'
    const content = spawnSync('pdftotext', ['-', '-'], { input: Buffer.from(await (await generateReportPdf(report)).arrayBuffer()) })
    assert.equal(content.status, 0); assert.match(content.stdout.toString(), count ? /QA-0002/ : /Sin registros/)
  }
})
test('unsupported font characters fail explicitly instead of silently losing contact names', async () => {
  const { generateReportPdf } = loadReportModule('documents/reportPdf.ts'), report = fixture('sales', 1)
  report.sections[0].rows[0].name = '客戶'
  await assert.rejects(() => generateReportPdf(report), /caracteres.*fuente/i)
})
test('donut with seven categories preserves the global denominator using a full comparison instead', async () => {
  const { generateReportPdf } = loadReportModule('documents/reportPdf.ts'), report = fixture('sales', 7)
  report.charts[0].kind = 'donut'; report.charts[0].points = Array.from({ length: 7 }, (_, i) => ({ label: `Método ${i + 1}`, value: 1 }))
  const result = spawnSync('pdftotext', ['-', '-'], { input: Buffer.from(await (await generateReportPdf(report)).arrayBuffer()) }).stdout.toString()
  assert.ok(!/^Total$/m.test(result), 'never label subset sums as the global total')
  assert.ok(result.includes('Método 7'))
})
test('long chart labels reserve sufficient vertical space before the next section', async () => {
  const { generateReportPdf } = loadReportModule('documents/reportPdf.ts'), report = fixture('sales', 1)
  report.charts[0].points = Array.from({ length: 2 }, (_, i) => ({ label: `Nombre ${i} ` + 'Textoextenso '.repeat(60), value: 125 }))
  report.sections[0].title = 'SECTION_AFTER_CHART'
  const xml = spawnSync('pdftotext', ['-bbox', '-', '-'], { input: Buffer.from(await (await generateReportPdf(report)).arrayBuffer()) }).stdout.toString()
  for (const page of xml.split('<page').slice(1)) {
    const labels = [...page.matchAll(/<word[^>]*yMax="([\d.]+)"[^>]*>Textoextenso<\/word>/g)].map(m => Number(m[1]))
    const section = page.match(/<word[^>]*yMin="([\d.]+)"[^>]*>SECTION_AFTER_CHART<\/word>/)
    if (section && labels.length) assert.ok(Number(section[1]) > Math.max(...labels), 'chart labels must not overlap next section')
  }
})
test('company branding is centered with optional logo instead of ERP vendor branding', async () => {
  const { generateReportPdf } = loadReportModule('documents/reportPdf.ts'), report = fixture('sales', 1)
  report.branding.companyName = 'EmpresaCentradaQA'
  for (const logo of [null, 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../public/auna/isotipo-192.png')).toString('base64')]) {
    report.branding.logoDataUrl = logo
    const pdf = Buffer.from(await (await generateReportPdf(report)).arrayBuffer())
    const xml = spawnSync('pdftotext', ['-bbox', '-', '-'], { input: pdf }).stdout.toString(), first = xml.split('<page')[1]
    assert.ok(!xml.includes('Auna ERP'))
    const match = first.match(/<word xMin="([\d.]+)"[^>]*xMax="([\d.]+)"[^>]*>EmpresaCentradaQA<\/word>/)
    assert.ok(match, 'company heading remains selectable text')
    assert.ok(Math.abs((Number(match[1]) + Number(match[2])) / 2 - 297.64) < 2, 'company heading centered on A4')
  }
})
test('wide landscape reports fit summary and first chart on the opening page instead of wasting it', async () => {
  const { makeReport } = require('./fixtures/reportFixtures.cjs'), { generateReportPdf } = loadReportModule('documents/reportPdf.ts')
  for (const id of ['alerts', 'products']) {
    const report = makeReport(id), pdf = Buffer.from(await (await generateReportPdf(report)).arrayBuffer())
    const first = spawnSync('pdftotext', ['-f', '1', '-l', '1', '-', '-'], { input: pdf }).stdout.toString()
    assert.ok(first.includes(report.charts[0].title), id + ' opening page should include its real chart')
  }
})

const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server'), { renderReportsPage, loadReportModule } = require('./helpers/loadReportModule.cjs'), { fixture } = require('./fixtures/reportFixtures.cjs')
test('viewer and exports receive the same real memoized PDF without a second preparation', async () => {
  const view = renderReportsPage({ prepared: fixture() }), dialog = view.nodes.find(n => typeof n.props.getPdf === 'function')
  assert.ok(dialog)
  const shown = await dialog.props.getPdf(), downloaded = await dialog.props.getPdf()
  assert.equal(shown, downloaded); assert.equal(view.pdfGenerationCalls.length, 1); assert.equal(view.preparationRequests.length, 0)
})
test('export callback downloads the supplied Blob and normalized filename without fetching', async () => {
  const blobs = [], clicks = [], nodes = [], blob = new Blob(['%PDF-QA'])
  const { ReportExportDialog } = loadReportModule('components/ReportExportDialog.tsx', { '../documents/reportDownload': { downloadReportBlob: (b, name) => { blobs.push(b); clicks.push(name) } } }, nodes)
  renderToStaticMarkup(React.createElement(ReportExportDialog, { open: false, onOpenChange() {}, report: fixture(), getPdf: async () => blob }))
  const dialog = nodes.find(n => n.type.name === 'ExportDialog')
  await dialog.props.onExport({ format: 'pdf', fileName: 'ventas-renombrado.pdf' })
  assert.equal(blobs[0], blob); assert.deepEqual(clicks, ['ventas-renombrado.pdf'])
})
test('PDF cache discards a late snapshot, retries failures and regenerates only for a new projection', async () => {
  const { hookHarness } = require('./helpers/reportHookHarness.cjs'), h = hookHarness(), generated = []
  const { useReportPdf } = loadReportModule('hooks/useReportPdf.ts', { react: h.hooks, '../documents/reportPdf': { generateReportPdf: report => new Promise((resolve, reject) => generated.push({ report, resolve, reject })) } })
  const a = fixture(), b = { ...a, title: 'Cambio de columnas' }
  const getA = h.render(() => useReportPdf(a)), old = getA(); const same = getA()
  await new Promise(resolve => setImmediate(resolve)); assert.equal(generated.length, 1)
  h.render(() => useReportPdf(b)); generated[0].resolve(new Blob(['old']))
  await assert.rejects(() => old, /cambió/); await assert.rejects(() => same, /cambió/)
  const getB = h.render(() => useReportPdf(b)), failed = getB(); await new Promise(resolve => setImmediate(resolve)); generated[1].reject(new Error('Fallo PDF')); await assert.rejects(() => failed)
  const retried = getB(); await new Promise(resolve => setImmediate(resolve)); generated[2].resolve(new Blob(['current'])); const blob = await retried
  assert.equal(await getB(), blob); assert.equal(generated.length, 3)
  h.unmount(); await assert.rejects(() => getB(), /cambió/)
})

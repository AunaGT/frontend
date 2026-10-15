const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server'), { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('PDF viewer has named controls, live loading, no automatic download or success claim for printing', () => {
  const nodes = [], { ReportDocumentPreview } = loadReportModule('components/ReportDocumentPreview.tsx', {}, nodes)
  const html = renderToStaticMarkup(React.createElement(ReportDocumentPreview, { pdf: new Blob(['%PDF-QA']), onDownload() {} }))
  for (const name of ['Página anterior', 'Página siguiente', 'Acercar', 'Alejar', 'Ajustar al ancho', 'Pantalla completa', 'Imprimir', 'Descargar PDF']) assert.ok(html.includes(name), name)
  assert.ok(html.includes('Cargando documento')); assert.ok(!html.includes('Impreso correctamente'))
})
test('each viewer effect destroys its own loading task and ignores a late old document', async () => {
  const { hookHarness } = require('./helpers/reportHookHarness.cjs'), h = hookHarness(), tasks = []
  const previousDocument = global.document
  global.document = { addEventListener() {}, removeEventListener() {} }
  try {
    const { ReportDocumentPreview } = loadReportModule('components/ReportDocumentPreview.tsx', { react: h.hooks,
      './pdfViewer': { pdfjs: { getDocument: () => { let tResolve; const t = { destroyed: false, destroy: async () => { t.destroyed = true }, promise: new Promise(resolve => { tResolve = resolve }) }; t.resolve = value => tResolve(value); tasks.push(t); return t } } },
    })
    const a = new Blob(['A']), b = new Blob(['B'])
    h.render(() => ReportDocumentPreview({ pdf: a, onDownload() {} })); await new Promise(resolve => setImmediate(resolve))
    h.render(() => ReportDocumentPreview({ pdf: b, onDownload() {} })); await new Promise(resolve => setImmediate(resolve))
    assert.equal(tasks[0].destroyed, true); assert.equal(tasks[1].destroyed, false)
    tasks[0].resolve({ getPage: async () => { throw Error('Old document should not render') } }); await new Promise(resolve => setImmediate(resolve))
    h.unmount(); assert.equal(tasks[1].destroyed, true)
  } finally { global.document = previousDocument }
})

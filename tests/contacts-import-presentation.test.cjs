const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const XLSX = require('xlsx')
const { renderToStaticMarkup } = require('react-dom/server')
const { StaticRouter } = require('react-router-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const contact = { nombre: 'Contacto QA', telefono: '+502 5555 5555', direccion: 'Guatemala', categoria: 'Bebidas', pago: 'Contado' }
function fileFor(rows = [contact]) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Contactos')
  return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'contactos.xlsx')
}

function importScreen(t) {
  const states = [], deps = [], effects = [], nodes = [], requests = [], writes = [], downloads = [], toasts = []
  let index = 0, effectIndex = 0, renderingPage = false, element
  const stream = { progress: null, cancelCount: 0, result: { created: 1, skipped: 0 }, error: null }
  const response = { value: { totals: { valid: 1, invalid: 0, skipped: 0 }, invalidRows: [] }, ok: true }
  const originalFetch = global.fetch, originalStorage = global.localStorage
  global.localStorage = { getItem: key => key === 'auth:token' ? 'qa-token' : null }
  global.fetch = async (url, options) => {
    requests.push({ url, ...options, body: JSON.parse(options.body) })
    return { ok: response.ok, json: async () => response.value, text: async () => JSON.stringify(response.value) }
  }
  t.after(() => { global.fetch = originalFetch; global.localStorage = originalStorage })
  const Page = loadReportModule('../contacts/pages/SupplierImportPage.tsx', {
    react: { ...React,
      useState: initial => {
        if (!renderingPage) return React.useState(initial)
        const key = index++
        if (!(key in states)) states[key] = typeof initial === 'function' ? initial() : initial
        return [states[key], next => { states[key] = typeof next === 'function' ? next(states[key]) : next }]
      },
      useMemo: (calculate, dependencies) => renderingPage ? calculate() : React.useMemo(calculate, dependencies),
      useEffect: (run, dependencies) => {
        if (!renderingPage) return React.useEffect(run, dependencies)
        const key = effectIndex++
        if (!deps[key] || dependencies.some((value, i) => value !== deps[key][i])) effects.push(run)
        deps[key] = dependencies
      },
    },
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => () => {} },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => toasts.push(value) }) },
    '@/components/layout/PageNavigation': { usePageTrail() {}, usePageNavigation: () => null },
    '@/services/api': { getApiBaseUrl: () => '/api', getAuthToken: () => 'qa-token', downloadFile: async (...args) => downloads.push(args) },
    '@/components/shared/useImportStream': { useImportStream: () => ({ progress: stream.progress, cancel: () => stream.cancelCount++, start: async (url, body) => {
      writes.push({ url, body })
      if (stream.error) throw stream.error
      return stream.result
    } }) },
  }, nodes).default
  function render() {
    do {
      index = 0; effectIndex = 0; renderingPage = true
      element = Page()
      renderingPage = false
      const pending = effects.splice(0)
      pending.forEach(run => run())
      if (!pending.length) break
    } while (true)
    nodes.length = 0
    return renderToStaticMarkup(React.createElement(StaticRouter, { location: '/contactos/importar' }, element))
  }
  return { render, workbench: () => element.props, nodes, requests, writes, downloads, toasts, stream, response }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
function button(nodes, label) {
  return nodes.find(node => node.props.onClick && renderToStaticMarkup(React.createElement(React.Fragment, null, node.props.children)).includes(label))
}

test('contact import uses the shared steps and authenticated template, rejecting unsupported files', async t => {
  const screen = importScreen(t)
  const html = screen.render()
  for (const label of ['1. Cargar archivo', '2. Mapeo de campos', '3. Validación', '4. Resultado']) assert.ok(html.includes(label), label)
  assert.equal(screen.workbench().back, '/contactos')
  assert.equal(button(screen.nodes, 'Validar archivo').props.disabled, true)
  assert.equal(button(screen.nodes, 'Importar 0 registros').props.disabled, true)
  await button(screen.nodes, 'Descargar plantilla').props.onClick(); await settle()
  assert.deepEqual(screen.downloads, [['/suppliers/template', 'plantilla_contactos.xlsx', { Authorization: 'Bearer qa-token' }]])
  assert.match(await screen.workbench().onFile(new File(['bad'], 'contactos.pdf')), /XLSX, XLS o CSV/)
  assert.match(await screen.workbench().onFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'contactos.xlsx')), /10 MB/)
  screen.render()
  assert.equal(screen.workbench().file, null)
  assert.equal(screen.requests.length, 0)
  assert.equal(screen.writes.length, 0)
})

test('upload, mapping, validation and preview keep contact fields and reset validation when changed', async t => {
  const screen = importScreen(t); screen.render()
  await screen.workbench().onFile(fileFor()); screen.render()
  assert.equal(button(screen.nodes, 'Validar archivo').props.disabled, false)
  assert.equal(button(screen.nodes, 'Importar 0 registros').props.disabled, true)
  screen.workbench().onValidate(); await settle()
  const html = screen.render()
  assert.match(html, /Contacto QA/)
  assert.equal(button(screen.nodes, 'Importar 1 registros').props.disabled, false)
  assert.equal(screen.requests[0].url, '/api/suppliers/validate-import-mapped')
  assert.equal(screen.requests[0].headers.Authorization, 'Bearer qa-token')
  assert.deepEqual(screen.requests[0].body, { suppliers: [{ name: 'Contacto QA', phone: '+502 5555 5555', address: 'Guatemala', category: 'Bebidas', payment_terms: 'Contado' }], importOptions: { paymentTermsWhenEmpty: 'default', createCategories: [], createPaymentTerms: [], skipRowIndexes: [], allowSimilarRowIndexes: [] } })
  assert.equal(screen.writes.length, 0, 'Validation must never save contacts')
  screen.workbench().onMappingChange('contact', 'nombre'); screen.render()
  assert.equal(screen.workbench().validated, false)
  assert.equal(screen.workbench().mappings.find(mapping => mapping.excelColumn === 'nombre').systemField, 'contact')
  assert.equal(button(screen.nodes, 'Validar archivo').props.disabled, true, 'The required name mapping was removed')
  assert.equal(button(screen.nodes, 'Importar 1 registros').props.disabled, true)
})

test('catalog corrections and row decisions revalidate instead of bypassing validation', async t => {
  const screen = importScreen(t); screen.render()
  await screen.workbench().onFile(fileFor()); screen.render()
  screen.response.value = { totals: { valid: 0, invalid: 1, skipped: 0 }, invalidRows: [{ rowIndex: 2, errors: ['Categoría desconocida'] }], resolutionHints: [{ kind: 'category', value: 'Bebidas', rowIndexes: [2] }, { kind: 'payment_term', value: 'Contado', rowIndexes: [2] }] }
  screen.workbench().onValidate(); await settle(); screen.render()
  assert.equal(button(screen.nodes, 'Importar 0 registros').props.disabled, true)
  assert.match(screen.render(), /Categoría desconocida/)
  await button(screen.nodes, 'Crear valor').props.onClick(); await settle(); screen.render()
  assert.deepEqual(screen.requests.at(-1).body.importOptions.createCategories, ['Bebidas'])
  await button(screen.nodes, 'Crear valor: Contado').props.onClick(); await settle(); screen.render()
  assert.deepEqual(screen.requests.at(-1).body.importOptions.createPaymentTerms, ['Contado'])
  await button(screen.nodes, 'Omitir filas').props.onClick(); await settle(); screen.render()
  assert.deepEqual(screen.requests.at(-1).body.importOptions.skipRowIndexes, [2])
  screen.workbench().onResolveRow(2, 'restore'); await settle(); screen.render()
  assert.deepEqual(screen.requests.at(-1).body.importOptions.skipRowIndexes, [])
  assert.equal(screen.writes.length, 0)
})

test('validation failures stay visible and source or payment changes require a fresh validation', async t => {
  const screen = importScreen(t); screen.render()
  await screen.workbench().onFile(fileFor()); screen.render()
  screen.response.ok = false
  screen.response.value = { message: 'No se pudo validar contactos' }
  screen.workbench().onValidate(); await settle()
  assert.match(screen.render(), /role="alert">No se pudo validar contactos/)
  assert.equal(button(screen.nodes, 'Importar 0 registros').props.disabled, true)
  screen.response.ok = true
  screen.response.value = { totals: { valid: 1, invalid: 0, skipped: 0 }, invalidRows: [] }
  screen.workbench().onValidate(); await settle(); screen.render()
  const paymentControl = screen.workbench().options.props.children.props.children.find(node => node?.type === 'select')
  paymentControl.props.onChange({ target: { value: 'require' } }); screen.render()
  assert.equal(screen.workbench().validated, false)
  assert.equal(button(screen.nodes, 'Importar 1 registros').props.disabled, true)
  screen.workbench().onValidate(); await settle(); screen.render()
  assert.equal(screen.requests.at(-1).body.importOptions.paymentTermsWhenEmpty, 'require')
  screen.workbench().onSheetChange('Contactos'); screen.render()
  assert.equal(screen.workbench().validated, false)
  screen.workbench().onValidate(); await settle(); screen.render()
  screen.workbench().onHeaderChange(false); screen.render()
  assert.equal(screen.workbench().validated, false)
  assert.equal(screen.workbench().useFirstRowAsHeader, false)
  assert.equal(screen.writes.length, 0)
})

test('stream progress, cancellation, successful results and server errors stay reachable', async t => {
  const screen = importScreen(t); screen.render()
  await screen.workbench().onFile(fileFor()); screen.render()
  screen.workbench().onValidate(); await settle(); screen.render()
  screen.stream.progress = { type: 'progress', phase: 'importing', processed: 1, total: 2 }
  assert.match(screen.render(), /Cancelar importación/)
  button(screen.nodes, 'Cancelar importación').props.onClick()
  assert.equal(screen.stream.cancelCount, 1)
  screen.stream.progress = null
  screen.render(); screen.workbench().onImport(); await settle()
  assert.match(screen.render(), /Importación finalizada/)
  assert.deepEqual(screen.writes[0], { url: '/api/suppliers/bulk-import-mapped-stream', body: screen.requests[0].body })
  await screen.workbench().onFile(fileFor()); screen.render()
  screen.stream.error = Object.assign(new Error('cancelled'), { name: 'AbortError' })
  screen.workbench().onImport(); await settle()
  assert.match(screen.render(), /Importación cancelada.*alguna fila pudo haberse guardado/)
  screen.stream.error = new Error('Error del servidor')
  screen.workbench().onImport(); await settle()
  assert.match(screen.render(), /role="alert">Error del servidor/)
})

test('dialog explains company-wide contact scope and keeps the contact wizard route', () => {
  const nodes = []
  const { SupplierImportDialog } = loadReportModule('../contacts/components/SupplierImportDialog.tsx', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company', name: 'Empresa QA' }, branch: { id: 'qa-branch', name: 'Sucursal QA' } }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    'react-router-dom': { useNavigate: () => () => {} },
    '@/services/api': { downloadFile() {} },
  }, nodes)
  renderToStaticMarkup(React.createElement(SupplierImportDialog, { open: false, onOpenChange() {} }))
  const dialog = nodes.find(node => node.type?.name === 'ImportDialog').props
  const scope = renderToStaticMarkup(React.createElement(React.Fragment, null, dialog.scopeNote))
  assert.match(scope, /Empresa QA/)
  assert.match(scope, /disponibles en todas sus sucursales/)
  assert.doesNotMatch(scope, /Sucursal QA/)
  assert.equal(dialog.wizardPath, '/contactos/importar')
  assert.equal(dialog.importType, 'suppliers')
})

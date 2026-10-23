const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const ts = require('typescript'), React = require('react'), runtime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const root = path.resolve(__dirname, '../../src')
function loadReportModule(relative, mocks = {}, nodes = []) {
  const cache = new Map()
  function load(file) {
    if (Object.hasOwn(mocks, file)) return mocks[file]
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.endsWith('.css')) return {}
      if (name === 'react/jsx-runtime') {
        const capture = factory => (type, props, key) => { nodes.push({ type, props }); return factory(type, props, key) }
        return { ...runtime, jsx: capture(runtime.jsx), jsxs: capture(runtime.jsxs) }
      }
      const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
      if (!local) return native(name)
      const resolved = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'].map(ext => local + ext)
        .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (!resolved) throw new Error(`No se resolvió ${name} desde ${file}`)
      return load(resolved)
    }
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})')
    mod._compile(ts.transpileModule(source, { fileName: file.replace(/\.mjs$/, '.ts'), compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, file)
    return mod.exports
  }
  return load(path.join(root, 'modules/reports', relative))
}
function renderReportsPage({ prepared = null, modules = new Set(['reports', 'sales', 'inventory']), moduleError = false, allowed = true, route = '/reportes?reporte=sales&vista=preview' } = {}) {
  const nodes = [], preparationRequests = [], pdfGenerationCalls = []
  const Page = loadReportModule('pages/ReportsManagement.tsx', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company' }, branch: { id: 'qa-branch' }, branches: [{ id: 'qa-branch', name: 'Principal' }], isConsolidated: false }) },
    '@/context/useModules': { useModules: () => ({ enabledModuleCodes: modules, isLoading: modules === null, isError: moduleError, refetch() {} }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => allowed, permissionsReady: true }) },
    '../hooks/usePreparedReport': { usePreparedReport: () => ({ report: prepared, pending: false, dirty: false, error: null,
      prepare: async () => { preparationRequests.push('prepare') }, clear() {} }) },
    '../documents/reportPdf': { generateReportPdf: async report => { pdfGenerationCalls.push(report); return new Blob(['%PDF-QA']) } },
    '@/services/warehouseService': { fetchWarehouses: async () => [] },
    '@/services/api': { apiFetch() { throw new Error('Petición inesperada en SSR') } },
    '@tanstack/react-query': { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(Page)))
  return { html, nodes, preparationRequests, pdfGenerationCalls }
}
module.exports = { loadReportModule, renderReportsPage }

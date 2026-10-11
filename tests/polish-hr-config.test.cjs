const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { StaticRouter } = require('react-router-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')

const requirements = Array.from({ length: 12 }, (_, i) => ({ id: `type-${i}`, name: `Requisito ${i}`, instructions: 'Documento del expediente', required: i === 0, active: true, sort_order: i }))
const versions = Array.from({ length: 14 }, (_, i) => ({ id: `version-${i}`, type_id: 'type-0', original_name: `archivo-${i}.pdf`, mime_type: 'application/pdf', size_bytes: 1024, created_at: '2026-10-01', archived_at: i ? '2026-10-02' : null, uploaded_by: 'qa-user' }))

function renderDocuments({ panel = false, allowed = true, disabled = false, confirmation = null } = {}) {
  const nodes = [], requests = [], changes = [], mutations = []
  let stateIndex = 0
  const query = { data: panel ? { items: requirements } : { requirements, items: versions, complete: true }, isPending: false, isFetching: false, isError: false }
  const mocks = {
    react: { ...React, useState: initial => React.useState(stateIndex++ === 0 ? confirmation : initial) },
    '@tanstack/react-query': { useQuery: () => query, useQueryClient: () => ({ invalidateQueries() {} }), useMutation: options => {
      const result = { ...options, isPending: false, mutate: value => requests.push(value) }; mutations.push(result); return result
    } },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: permission => Array.isArray(allowed) ? allowed.includes(permission) : allowed }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company' } }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/hrService': { uploadEmployeeDocument: async (...args) => changes.push(['upload', ...args]), archiveEmployeeDocument: async (...args) => changes.push(['archive', ...args]), accessEmployeeDocument() { throw new Error('No real file access') } },
  }
  const page = panel ? 'EmployeeDocumentsPanel' : 'EmployeeDocuments'
  const Component = loadReportModule(`../hr/pages/${page}.tsx`, mocks, nodes)[page]
  const selection = { typeId: 'type-0', file: { name: 'dpi.pdf', size: 1024, type: 'application/pdf' } }
  const props = panel ? { selections: [selection], onChange: value => changes.push(value), disabled } : { employeeId: 'qa-employee' }
  const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/rrhh/qa-employee' }, React.createElement(Component, props)))
  return { html, nodes, requests, changes, mutations, selection }
}

test('employee requirements and versions remain complete in accessible local lists', () => {
  const { html } = renderDocuments()
  assert.match(html, /class="hr-document-scroll"[^>]*role="region"[^>]*aria-label="Documentos del expediente"[^>]*tabindex="0"/)
  assert.match(html, /<ul[^>]*aria-label="Requisitos documentales"/)
  assert.match(html, /<ul[^>]*aria-label="Versiones de documentos"/)
  assert.equal((html.match(/<li class="hr-document-row/g) || []).length, 26)
  assert.match(html, /Requisito 11/)
  assert.match(html, /archivo-13.pdf/)
  assert.match(html, /Versión archivada/)
})

test('creation keeps document dropzones, disabled state and selection removal inside semantic rows', () => {
  const { html, nodes, changes } = renderDocuments({ panel: true })
  assert.match(html, /role="region"[^>]*aria-label="Requisitos de documentos"[^>]*tabindex="0"/)
  assert.equal((html.match(/<li class="hr-document-row/g) || []).length, 12)
  assert.equal((html.match(/auna-file-dropzone hr-document-dropzone/g) || []).length, 12)
  nodes.find(n => n.props?.children === 'Retirar selección').props.onClick()
  assert.deepEqual(changes, [[]])
  const locked = renderDocuments({ panel: true, disabled: true })
  assert.ok(locked.nodes.filter(n => n.props?.className === 'auna-file-dropzone hr-document-dropzone').every(n => n.props.disabled))
})

test('document permissions still hide upload, archive and restore actions', () => {
  const { html } = renderDocuments({ allowed: false })
  assert.doesNotMatch(html, /Cargar o reemplazar|>Archivar<|>Restaurar</)
  assert.match(html, />Ver</)
  assert.match(html, />Descargar</)
  const uploadOnly = renderDocuments({ allowed: ['hr.documents.manage'] }).html
  assert.match(uploadOnly, /Cargar o reemplazar/)
  assert.doesNotMatch(uploadOnly, />Archivar<|>Restaurar</)
  const archiveOnly = renderDocuments({ allowed: ['hr.documents.archive'] }).html
  assert.doesNotMatch(archiveOnly, /Cargar o reemplazar/)
  assert.match(archiveOnly, />Archivar</)
  assert.match(archiveOnly, />Restaurar</)
})

test('document viewing and downloading preserve their distinct access requests', () => {
  const { nodes, requests } = renderDocuments()
  nodes.find(n => n.props?.children?.includes?.('Ver')).props.onClick()
  nodes.find(n => n.props?.children?.includes?.('Descargar')).props.onClick()
  assert.deepEqual(requests, [{ item: versions[0], download: false }, { item: versions[0], download: true }])
})

test('replacement and archive or restore retain the existing employee and version arguments', async () => {
  const { nodes, requests, mutations, changes } = renderDocuments()
  const file = { name: 'nuevo.pdf' }, input = nodes.find(n => n.props?.['aria-label'] === 'Cargar Requisito 0')
  input.props.onChange({ target: { files: [file], value: 'selected' } })
  assert.deepEqual(requests, [{ typeId: 'type-0', file }])
  await mutations[0].mutationFn(requests[0])
  await mutations[0].mutationFn({ document: versions[0] })
  await mutations[0].mutationFn({ document: versions[1] })
  assert.deepEqual(changes, [['upload', 'qa-employee', 'type-0', file], ['archive', 'qa-employee', 'version-0', false], ['archive', 'qa-employee', 'version-1', true]])
})

const modules = Array.from({ length: 10 }, (_, i) => ({ code: `module-${i}`, name: `Módulo ${i}`, status: i === 1 ? 'DISABLED' : i === 2 ? 'TRIAL' : 'ACTIVE', effectiveEnabled: i !== 1 && i !== 3, protected: i === 0, dependencies: i === 3 ? ['module-1'] : [], blockedBy: i === 3 ? ['module-1'] : [], trialEndsAt: null }))
function renderModules({ canManage = true, state = {} } = {}) {
  const nodes = [], changes = [], requests = []
  let stateIndex = 0
  const Component = loadReportModule('../config/pages/ModulesSettings.tsx', {
    react: { ...React, useState: initial => {
      const i = stateIndex++, value = Object.hasOwn(state, i) ? state[i] : initial
      const [current, setCurrent] = React.useState(value)
      return [current, next => { changes.push({ index: i, value: next }); setCurrent(next) }]
    } },
    '@/context/useModules': { useModules: () => ({ modules, isLoading: false, isError: false, refetch: async () => {} }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/moduleService': { updateCompanyModule: async (...args) => requests.push(args) },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Component, { canManage })), nodes, changes, requests }
}

test('module summary precedes compact filters and shared pagination stays outside the table', () => {
  const { html, nodes, changes } = renderModules()
  assert.match(html, /metric-strip/)
  assert.ok(html.indexOf('metric-strip') < html.indexOf('compact-filter-toolbar'))
  assert.match(html, /aria-label="Filtros de módulos"/)
  assert.match(html, /auna-data-table-shell/)
  assert.match(html, /auna-pagination-outside/)
  assertPaginationOutside(html)
  assert.match(html, /Mostrando 1 a 8 de 10 módulos/)
  nodes.find(n => n.props?.['aria-label'] === 'Página siguiente').props.onClick()
  assert.deepEqual(changes.at(-1), { index: 4, value: 2 })
})

test('module guards, effective dependency status and toggle payload stay intact', async () => {
  const { html, nodes, requests } = renderModules()
  assert.match(html, /Bloqueado/)
  assert.match(html, /Requiere activar module-1/)
  assert.equal(nodes.find(n => n.props?.['aria-label'] === 'Desactivar Módulo 0').props.disabled, true)
  const blocked = nodes.find(n => n.props?.['aria-label'] === 'Desactivar Módulo 3')
  assert.equal(blocked.props.checked, true)
  assert.equal(blocked.props.disabled, false)
  await nodes.find(n => n.props?.['aria-label'] === 'Activar Módulo 1').props.onCheckedChange(true)
  assert.deepEqual(requests, [['module-1', { status: 'ACTIVE' }]])
  assert.ok(renderModules({ canManage: false }).nodes.filter(n => n.props?.onCheckedChange).every(n => n.props.disabled))
})

test('module search and status retain filtering and reset the page', () => {
  const { nodes, changes } = renderModules()
  nodes.find(n => n.props?.['aria-label'] === 'Buscar módulo').props.onChange({ target: { value: 'Módulo 1' } })
  assert.deepEqual(changes.slice(-2), [{ index: 2, value: 'Módulo 1' }, { index: 4, value: 1 }])
  assert.match(renderModules({ state: { 1: 'trial', 4: 2 } }).html, /Mostrando 1 a 1 de 1 módulos/)
  assert.match(renderModules({ state: { 2: 'module-1' } }).html, /Bloqueado/)
})

test('document rows use dividers without card frames and their scroll is bounded with visible focus', async () => {
  const fs = require('node:fs'), path = require('node:path')
  const { root } = await require('postcss')().process(fs.readFileSync(path.join(__dirname, '../src/modules/hr/pages/hr.css'), 'utf8'), { from: undefined })
  const values = selector => {
    const declarations = new Map()
    root.walkRules(rule => { if (rule.selector === selector && rule.parent.type === 'root') rule.walkDecls(d => declarations.set(d.prop, d.value)) })
    return declarations
  }
  assert.equal(values('.hr-document-row').get('border'), undefined)
  assert.equal(values('.hr-document-row').get('border-radius'), undefined)
  assert.ok(values('.hr-document-row').get('border-bottom'))
  assert.equal(values('.hr-document-scroll').get('max-height'), 'min(60vh, 520px)')
  assert.equal(values('.hr-document-scroll').get('overflow-y'), 'auto')
  assert.ok(values('.hr-document-scroll:focus-visible').get('outline'))
  assert.equal(values('.hr-record-container').get('padding'), '32px')
})

const employee = { id: 'qa-employee', first_name: 'Ana', last_name: 'Pérez', code: 'EMP-1', status: 'ACTIVO', hire_date: '2026-01-01', base_salary: '3000', bonificacion_incentivo: '250', contract_type: 'INDEFINIDO', pay_frequency: 'MENSUAL', payment_method: 'EFECTIVO' }
function renderEmployee(allowed) {
  const previousWindow = global.window
  global.window = { location: { search: '' } }
  try {
    let stateIndex = 0
    const Page = loadReportModule('../hr/pages/EmployeeDetailPage.tsx', {
      './api': { apiFetch() { throw new Error('No real requests in SSR') } },
      '@/services/api': { apiFetch() { throw new Error('No real requests in SSR') } },
      '@/hooks/useSystemSettings': { useSystemSettings: () => ({ timezone: 'America/Guatemala' }) },
      react: { ...React, useEffect() {}, useState: initial => React.useState(stateIndex++ === 4 ? employee : initial) },
      '@/components/layout/PageNavigation': { usePageTrail() {} },
      '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company' } }) },
      '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: permission => allowed.includes(permission) }) },
      '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
      '@/services/api': { apiFetch() { throw new Error('No real requests in SSR') } },
      '@/hooks/useSystemSettings': { useSystemSettings: () => ({ timezone: 'America/Guatemala' }) },
      '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'hr-employee' ? employee : queryKey[0] === 'hr-employee-overview' ? { history: { count: 0 } } : { items: [] }, isPending: false, isError: false }), useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }) },
    }).default
    return renderToStaticMarkup(React.createElement(StaticRouter, { location: '/rrhh/qa-employee' }, React.createElement(Page)))
  } finally { global.window = previousWindow }
}

test('employee detail uses shared section tabs while preserving permission visibility', () => {
  const html = renderEmployee(['hr.documents.view', 'hr.attendance.view', 'hr.advances.view'])
  assert.match(html, /role="tablist"[^>]*aria-label="Secciones del expediente"/)
  assert.match(html, /data-\[state=active\]:bg-brand-orange/)
  assert.match(html, /Asistencia/)
  assert.match(html, /Anticipos/)
  assert.match(html, /Documentos/)
  const denied = renderEmployee([])
  assert.doesNotMatch(denied, /role="tab"[^>]*>.*(?:Asistencia|Anticipos|Documentos).*?<\/button>/)
  assert.doesNotMatch(denied, />Editar<|>Dar de baja</)
})

const payslip = { id: 'slip-1', employee, days_worked: '30', total_earnings: '3250.00', total_deductions: '145.00', net_pay: '3105.00', employer_cost: '380.00', lines: [{ id: 'earning', type: 'DEVENGO', description: 'Salario', amount: '3250.00', quantity: '30' }, { id: 'deduction', type: 'DEDUCCION', description: 'IGSS', amount: '145.00' }, { id: 'cost', type: 'COSTO_PATRONAL', description: 'Costo patronal', amount: '380.00' }] }
test('payslip screen surface preserves employee, earnings, deductions and net receipt values', () => {
  const Card = loadReportModule('../payroll/pages/PayslipCard.tsx').default
  const html = renderToStaticMarkup(React.createElement(Card, { payslip }))
  assert.match(html, /auna-surface payroll-payslip/)
  assert.match(html, /Ana.*Pérez/)
  for (const amount of ['3,250.00', '145.00', '3,105.00', '380.00']) assert.ok(html.includes(amount))
  assert.match(html, /Pago: Efectivo/)
})

test('payroll pages share the same responsive page measure and keep pagination outside cards', () => {
  const run = { id: 'run-1', code: 'NOM-1', name: 'Octubre', type: 'ORDINARIA', status: 'BORRADOR', period_start: '2026-10-01', period_end: '2026-10-31', pay_date: '2026-10-31', total_earnings: '3250', total_deductions: '145', total_net: '3105', total_employer_cost: '380', payslips: [payslip] }
  for (const page of ['PayrollRunsManagement', 'PayrollRunDetail']) {
    const Page = loadReportModule(`../payroll/pages/${page}.tsx`, {
      '@/services/api': { apiFetch() { throw new Error('No real requests in SSR') } },
      '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
      '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => false }) },
      '@tanstack/react-query': { useQuery: () => ({ data: page === 'PayrollRunDetail' ? run : { items: [run] }, isLoading: false, isFetching: false, isError: false }), useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }) },
    }).default
    const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/nomina/run-1' }, React.createElement(Page)))
    assert.match(html, /max-w-\[1560px\] space-y-5 p-4 sm:p-8/)
    assertPaginationOutside(html)
    assert.doesNotMatch(html, /Nueva corrida|Confirmar nómina|Marcar pagada|>Anular</)
  }
})

test('printed payroll receipt overrides dark surface and text tokens to readable white paper', async () => {
  const fs = require('node:fs'), path = require('node:path')
  const { root } = await require('postcss')().process(fs.readFileSync(path.join(__dirname, '../src/modules/payroll/pages/payrollPrint.css'), 'utf8'), { from: undefined })
  let paper = false, ink = false
  root.walkAtRules('media', media => { if (media.params !== 'print') return; media.walkRules(rule => {
    if (!rule.selector.includes('.payroll-receipt') && !rule.selector.includes('.payroll-payslip')) return
    rule.walkDecls(d => { if (d.prop === 'background' && d.value === '#fff' && d.important) paper = true; if (d.prop === 'color' && d.value === '#111' && d.important) ink = true })
  }) })
  assert.ok(paper, 'Receipt printing must explicitly use white paper')
  assert.ok(ink, 'Receipt printing must explicitly use readable dark ink')
})

test('printed receipt gives the real dialog header white paper despite its dark background slot', async () => {
  const fs = require('node:fs'), path = require('node:path')
  const { DialogHeader } = loadReportModule('../../components/ui/dialog.tsx')
  const header = renderToStaticMarkup(React.createElement(DialogHeader, null, 'Recibo de nómina'))
  const slot = header.match(/data-slot="([^"]+)"/)[1]
  const { root } = await require('postcss')().process(fs.readFileSync(path.join(__dirname, '../src/modules/payroll/pages/payrollPrint.css'), 'utf8'), { from: undefined })
  let headerPaper = false
  root.walkAtRules('media', media => {
    if (media.params !== 'print') return
    media.walkRules(rule => {
      const matchesHeader = rule.selectors.some(selector => selector.replaceAll('"', '').replaceAll("'", '').endsWith(`.payroll-receipt [data-slot=${slot}]`))
      if (matchesHeader) rule.walkDecls('background', declaration => { if (declaration.value === '#fff' && declaration.important) headerPaper = true })
    })
  })
  assert.ok(headerPaper, 'The dialog header has its own dark background and needs a white print override')
})

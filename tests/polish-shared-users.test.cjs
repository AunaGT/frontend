const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const XLSX = require('xlsx')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

test('icon-only view tabs have individual names without changing their visible layout or values', () => {
  const nodes = [], changes = []
  const { ModuleTabBar } = loadReportModule('../../components/shared/ModuleTabs.tsx', {}, nodes)
  const html = renderToStaticMarkup(React.createElement(ModuleTabBar, {
    value: 'table', ariaLabel: 'Vista', onValueChange: v => changes.push(v),
    items: [{ value: 'table', label: '', ariaLabel: 'Tabla' }, { value: 'cards', label: '', ariaLabel: 'Tarjetas' }],
  }))
  assert.match(html, /role="tab"[^>]*aria-label="Tabla"/)
  assert.match(html, /role="tab"[^>]*aria-label="Tarjetas"/)
  assert.doesNotMatch(html, />Tabla<|>Tarjetas</)
  nodes.find(n => n.type === 'button' && n.props['aria-label'] === 'Tarjetas').props.onClick()
  assert.deepEqual(changes, ['cards'])
})

function importScreen() {
  const nodes = [], states = [], requests = [], writes = [], progress = { value: null }
  let index = 0
  const Page = loadReportModule('../users/UserImportPage.tsx', {
    react: { ...React, useState: initial => {
      const key = index++
      if (!(key in states)) states[key] = typeof initial === 'function' ? initial() : initial
      return [states[key], next => { states[key] = typeof next === 'function' ? next(states[key]) : next }]
    } },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'company-qa', name: 'Empresa QA' } }) },
    '@/components/layout/PageNavigation': { usePageTrail() {}, usePageNavigation: () => null },
    '@/services/api': { getApiBaseUrl: () => '/api', getAuthToken: () => null, downloadFile() {},
      apiFetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { totals: { total: 1, valid: 1, invalid: 0, skipped: 0 }, invalidRows: [] } } },
    '@/components/shared/useImportStream': { useImportStream: () => ({ progress: progress.value, cancel() {}, start: async (url, body) => { writes.push({ url, body }); return { created: 1, skipped: 0, errors: [] } } }) },
  }, nodes).default
  function render() {
    index = 0; nodes.length = 0
    return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
  }
  function workbench() { const node = nodes.find(n => n.type?.name === 'ImportWorkbench'); assert.ok(node, 'Usuarios debe usar el flujo compartido de importación'); return node.props }
  return { render, workbench, states, requests, writes }
}

function fileFor(rows) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Usuarios')
  return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'usuarios-qa.xlsx')
}

const row = { Nombre: 'Usuario QA', Correo: 'qa@example.test', Rol: 'vendedor', Contraseña: 'QA-Secret-123456' }

test('user creation uses shared submit and password controls without changing submission guards', () => {
  const nodes = [], writes = [], feedback = []
  const Page = loadReportModule('../users/UserCreatePage.tsx', {
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'qa-user' }, permissionsReady: true, hasPermission: () => true }) },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa', code: 'GT', name: 'Empresa QA', country: 'GT', currency: 'GTQ' }, companies: [{ id: 'qa', code: 'GT', name: 'Empresa QA', country: 'GT', currency: 'GTQ' }] }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: message => feedback.push(message) }) },
    '@/hooks/useCreateUser': { useCreateUser: () => ({ isPending: false, mutateAsync: payload => writes.push(payload) }) },
    '@tanstack/react-query': { useQuery: () => ({ data: null, isLoading: false }) },
    '@/services/userService': { getRoles: async () => [], getRoleWithPermissions: async () => null },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
  assert.match(html, /aria-label="Mostrar contraseña"/)
  const submit = nodes.find(n => n.props?.children?.some?.(child => child?.props?.children === 'Crear usuario'))
  assert.ok(submit)
  assert.equal(submit.type.displayName, 'Button')
  assert.doesNotMatch(html, /btn-auna-primary|btn-auna-outline/)
  submit.props.onClick()
  assert.equal(writes.length, 0)
  assert.match(feedback[0].title, /nombre es obligatorio/)
})

test('users exposes a named direct detail action while edit remains permission-protected', () => {
  for (const canEdit of [false, true]) {
    const nodes = [], navigations = []
    const Page = loadReportModule('../users/UserManagement.tsx', {
      'react-router-dom': { ...require('react-router-dom'), useNavigate: () => path => navigations.push(path) },
      '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa', name: 'Empresa QA' }, companies: [], setCompany() {} }) },
      '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: code => code === 'users.view' || (canEdit && code === 'users.edit') }) },
      '@/services/userService': { getUsers() { throw Error('No real user query') }, getRoles() { throw Error('No real role query') } },
      '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ isLoading: false, isFetching: false, data: queryKey[0] === 'users' ? { page: 1, totalPages: 1, totalItems: 1, items: [{ id: 'user-qa', name: 'Usuario QA', email: 'qa@example.test', access_status: 'ACTIVE', role: { id: 1, name: 'vendedor' }, companies: [], last_login_at: null }], summary: { total: 1, ACTIVE: 1, INACTIVE: 0, BLOCKED: 0 } } : [] }) },
    }, nodes).default
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
    assert.match(html, /aria-label="Ver detalles de Usuario QA"/)
    assert.equal(html.includes('aria-label="Editar Usuario QA"'), canEdit)
    assert.equal(html.includes('aria-label="Acciones de Usuario QA"'), canEdit, 'La consulta no debe abrir un menú vacío')
    nodes.find(n => n.props['aria-label'] === 'Ver detalles de Usuario QA').props.onClick()
    assert.deepEqual(navigations, ['/usuarios/user-qa'])
  }
})

test('accounting line controls identify each amount and deletion without relaxing balance guards', () => {
  const nodes = []
  const { NewEntryDialog } = loadReportModule('../accounting/components/NewEntryDialog.tsx', {
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/accountingService': { createJournalEntry() { throw Error('No real accounting writes') } },
  }, nodes)
  renderToStaticMarkup(React.createElement(NewEntryDialog, { open: false, onOpenChange() {}, accounts: [], onSaved() {} }))
  for (const label of ['Cuenta de la línea 1', 'Debe de la línea 1', 'Haber de la línea 1', 'Quitar línea 1', 'Debe de la línea 2']) assert.ok(nodes.some(n => n.props['aria-label'] === label), label)
  const remove = nodes.find(n => n.props['aria-label'] === 'Quitar línea 1')
  assert.equal(remove.props.disabled, true)
  const save = nodes.find(n => n.props.children === 'Guardar asiento')
  assert.equal(save.props.disabled, true)
})

test('read-only roles use the view icon and do not expose mutation actions', () => {
  const Page = loadReportModule('../users/RolesPermissionsManagement.tsx', {
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => false }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/userService': {},
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }), useQuery: ({ queryKey }) => ({ isLoading: false, data: queryKey[0] === 'roles-with-permissions' ? { page: 1, totalPages: 1, totalItems: 1, items: [{ id: 7, name: 'Consulta QA', permissions: [], protected: false, usersCount: 1 }], stats: { totalRoles: 1, assignedUsers: 1, modules: 22 } } : [] }) },
  }).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
  assert.match(html, /aria-label="Ver permisos de Consulta QA"/)
  assert.match(html, /lucide-eye/)
  assert.doesNotMatch(html, /lucide-pencil|Duplicar Consulta QA|Eliminar Consulta QA|Crear rol/)
})

test('user import keeps mapped payload and hides credentials in the shared preview, then clears the source', async () => {
  const screen = importScreen(); screen.render()
  await screen.workbench().onFile(fileFor([row])); screen.render()
  assert.equal(screen.workbench().maxSizeBytes, 5 * 1024 * 1024)
  await screen.workbench().onValidate()
  const html = screen.render()
  assert.match(html, /Usuario QA/)
  assert.match(html, /qa@example.test/)
  assert.doesNotMatch(html, /QA-Secret-123456/)
  assert.deepEqual(screen.requests[0].body.rows, [{ name: 'Usuario QA', email: 'qa@example.test', role: 'vendedor', password: 'QA-Secret-123456' }])
  await screen.workbench().onImport()
  assert.equal(screen.writes.length, 1)
  assert.deepEqual(screen.writes[0].body, screen.requests[0].body)
  const result = screen.render()
  assert.match(result, /Importación finalizada/)
  assert.doesNotMatch(result, /QA-Secret-123456/)
  assert.equal(screen.workbench().file, null)
  assert.equal(screen.workbench().rows.length, 0)
})

test('user import keeps its stricter file and row limits without enabling a write', async () => {
  const screen = importScreen(); screen.render()
  const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'usuarios.xlsx')
  assert.match(await screen.workbench().onFile(oversized), /5 MB/)
  assert.equal(screen.render().includes('QA-Secret-123456'), false)
  assert.equal(screen.workbench().file, null)
  assert.match(await screen.workbench().onFile(fileFor(Array.from({ length: 1001 }, () => row))), /1000 filas/)
  screen.render()
  assert.equal(screen.workbench().file, null)
  assert.equal(screen.requests.length, 0)
  assert.equal(screen.writes.length, 0)
})

test('shared import respects the caller file limit in its visible instructions', () => {
  const { ImportWorkbench } = loadReportModule('../../components/shared/ImportWorkbench.tsx', {
    '@/components/layout/PageNavigation': { usePageTrail() {}, usePageNavigation: () => null },
    '@/services/api': { getAuthToken: () => null, downloadFile() {} },
  })
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(ImportWorkbench, {
    title: 'Usuarios', description: 'Importación', back: '/usuarios', backLabel: 'Usuarios', templatePath: '', templateName: '',
    file: null, onFile() {}, sheetNames: [], selectedSheet: '', onSheetChange() {}, fields: [], mappings: [], rows: [], firstErrorIndex: 2,
    validated: false, validCount: 0, errors: [], onValidate() {}, onImport() {}, result: null, maxSizeBytes: 5 * 1024 * 1024,
  })))
  assert.match(html, /Hasta 5 MB/)
  assert.doesNotMatch(html, /Hasta 10 MB/)
})

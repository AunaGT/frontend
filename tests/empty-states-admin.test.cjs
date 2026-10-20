const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { StaticRouter } = require('react-router-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const noop = () => {}
const api = { apiFetch() { throw new Error('Unexpected network request') }, ApiError: class extends Error {}, getApiBaseUrl: () => 'http://localhost', getAuthToken: () => '', tenantHeaders: () => ({}) }
const empty = { items: [], requirements: [], totalItems: 0, totalPages: 1, page: 1, summary: {} }
function render(file, name, props = {}, options = {}) {
  const nodes = []
  const result = { data: empty, isLoading: false, isPending: false, isFetching: false, isError: false, error: null, refetch: noop, ...options.result }
  const mutation = { isPending: false, mutate: noop, mutateAsync: async () => {} }
  const allowed = options.allowed ?? true
  let stateIndex = 0
  const stateChanges = []
  const Component = loadReportModule(`../${file}`, {
    '@/services/api': api,
    './api': api,
    '../services/api': api,
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'company', name: 'Empresa' }, branch: { id: 'branch' }, branches: [], companies: [], setCompany: noop, isConsolidated: false }) },
    '@/context/useAuth': { useAuth: () => ({ refreshUser: noop }) },
    '@/components/layout/PageNavigation': { usePageTrail: noop },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ timezone: 'America/Guatemala', companyName: 'Empresa', currencySymbol: 'Q' }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...permissions) => typeof allowed === 'function' ? allowed(...permissions) : allowed, permissionsReady: true, user: { id: 'user' } }) },
    react: { ...React, useState: initial => {
      const index = stateIndex++
      const [value, setValue] = React.useState(Object.hasOwn(options.states || {}, index) ? options.states[index] : initial)
      return [value, next => { stateChanges.push({ index, value: next }); setValue(next) }]
    } },
    'react-router-dom': { ...require('react-router-dom'), useParams: () => ({ id: 'record' }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: noop }) },
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 1, pageSize: 10, setPage: noop, setPageSize: noop }), useResetPageOnFilterChange: noop },
    '@/context/useModules': { useModules: () => ({ modules: [], enabledModuleCodes: new Set(), isLoading: false, isError: false, refetch: noop }) },
    '@tanstack/react-query': { useQuery: options.query || (() => result), useMutation: () => mutation, useQueryClient: () => ({ invalidateQueries: noop }) },
    ...options.mocks,
  }, nodes)[name]
  const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' }, React.createElement(Component, props)))
  return { html, nodes, stateChanges }
}

test('empty user role action opens the existing role assignment editor', () => {
  const { nodes, stateChanges } = render('users/UserDetailPage.tsx', 'default', {}, { states: { 0: { id: 'user', name: 'Ana', email: 'ana@example.test', companies: [], permissions: [] }, 1: false } })
  const empty = nodes.find(n => n.props.title === 'Un rol para cada responsabilidad')
  empty.props.action.props.onClick()
  assert.ok(stateChanges.some(change => change.index === 6 && change.value === true), 'opens the existing editor instead of the read-only role tab')
})

test('selected role with no permissions explains the empty collection in user creation', () => {
  const { html } = render('users/UserCreatePage.tsx', 'default', {}, {
    states: { 13: [24] }, result: { data: { id: 24, permissions: [] } },
    mocks: { '@/hooks/useRoles': { useRoles: () => ({ data: [{ id: 24, name: 'Consulta' }] }) }, '@/hooks/useCreateUser': { useCreateUser: () => ({ isPending: false }) } },
  })
  assert.match(html, /Este rol espera sus permisos/)
  assert.match(html, /workspace-flat\.png/)
})

test('assigned role without effective permissions has an illustrated readonly table row', () => {
  const { html } = render('users/UserDetailPage.tsx', 'default', {}, { states: { 0: { id: 'user', name: 'Ana', email: 'ana@example.test', companies: [], permissions: [], role: { id: 24, name: 'Consulta' } }, 1: false, 5: 'roles' } })
  assert.match(html, /Este rol espera sus permisos/)
  assert.match(html, /colSpan="4"/i)
})

test('tenant branch load failure displays its error and retry before empty collection', () => {
  const { html } = render('users/UserTenantAccessCard.tsx', 'UserTenantAccessCard', { userId: 'user', userCompanies: [{ id: 'company', name: 'Empresa' }], canManage: false, onChanged: noop }, { states: { 4: false, 6: new Error('Acceso no disponible') } })
  assert.match(html, /Acceso no disponible/)
  assert.match(html, /Reintentar/)
  assert.doesNotMatch(html, /workspace-flat\.png/)
})

test('cash assignment picker renders a compact search state and reset callback', () => {
  const { nodes } = render('catalogs/components/CashRegistersTab.tsx', 'CashRegistersTab', {}, { states: { 7: { id: 'register', name: 'Caja', branch: { id: 'branch' } }, 9: 'Ana', 10: 'Ana' }, query: ({ queryKey }) => ({ data: queryKey[0] === 'users' ? empty : [], isLoading: false, isFetching: false, error: null }) })
  const collection = nodes.find(n => n.props.title === 'El equipo de esta caja aparecerá aquí')
  assert.ok(collection, 'assignment dialog has its own collection empty state')
  assert.equal(collection.props.compact, true)
  assert.equal(collection.props.filtered, true)
  assert.equal(typeof collection.props.onReset, 'function')
})

test('Feedback renders contextual illustration and initial action, but errors and loading take precedence', () => {
  const props = { empty: true, emptyTitle: 'Tu equipo empieza aquí', emptyDescription: 'Invita al primer usuario.', emptyAction: React.createElement('button', {}, 'Nuevo usuario') }
  const { html } = render('users/UsersUI.tsx', 'Feedback', props)
  assert.match(html, /workspace-flat\.png/)
  assert.match(html, /Tu equipo empieza aquí/)
  assert.match(html, /Nuevo usuario/)
  for (const state of [{ error: new Error('Fallo de carga') }, { loading: true }]) {
    const failed = render('users/UsersUI.tsx', 'Feedback', { ...props, ...state }).html
    assert.doesNotMatch(failed, /workspace-flat\.png|Nuevo usuario/)
  }
})

test('Feedback filtered collection hides create action and offers reset', () => {
  const { html, nodes } = render('users/UsersUI.tsx', 'Feedback', { empty: true, filtered: true, onReset: noop, emptyAction: React.createElement('button', {}, 'Nuevo usuario') })
  assert.match(html, /Busquemos por otro lado/)
  assert.match(html, /Limpiar filtros/)
  assert.doesNotMatch(html, /Nuevo usuario/)
  assert.ok(nodes.some(n => n.props.children === 'Limpiar filtros' && n.props.onClick === noop))
})

for (const [file, name, props, result] of [
  ['users/PermissionMatrix.tsx', 'PermissionMatrix', { catalog: [], selected: [], onChange: noop }],
  ['hr/pages/EmployeeHistory.tsx', 'EmployeeHistory', { employeeId: 'employee' }],
  ['hr/pages/EmployeeAttendance.tsx', 'EmployeeAttendance', { employeeId: 'employee' }],
  ['hr/pages/EmployeeDocuments.tsx', 'EmployeeDocuments', { employeeId: 'employee' }],
  ['config/components/SettingsRelatedLinks.tsx', 'SettingsRelatedLinks', { confirmLeave: noop }],
  ['config/components/SettingsHistorySection.tsx', 'SettingsHistorySection', {}],
  ['branches/pages/CompaniesCard.tsx', 'CompaniesCard', { canManage: false, activeBranches: [], onAddBranch: noop }, { data: [] }],
  ['branches/pages/WarehousesCard.tsx', 'WarehousesCard', { canManage: false, branches: [] }, { data: [] }],
  ['hr/pages/EmployeesManagement.tsx', 'EmployeesManagement', {}],
  ['hr/pages/AdvancesManagement.tsx', 'AdvancesManagement', { employeeId: 'employee' }],
  ['payroll/pages/PayrollRunsManagement.tsx', 'PayrollRunsManagement', {}],
]) {
  test(`${name} renders an illustrated empty collection without artificial create actions for readonly access`, () => {
    const { html } = render(file, name, props, { allowed: false, result })
    assert.match(html, /workspace-flat\.png/)
    assert.doesNotMatch(html, />Nuevo anticipo<|>Nueva corrida<|>Nueva empresa<|>Nuevo almacén</)
  })
}

test('HR history errors retain retry without an empty illustration', () => {
  const { html } = render('hr/pages/EmployeeHistory.tsx', 'EmployeeHistory', { employeeId: 'employee' }, { result: { data: undefined, isError: true } })
  assert.match(html, /No se pudo cargar el historial/)
  assert.match(html, /Reintentar/)
  assert.doesNotMatch(html, /workspace-flat\.png/)
})

for (const [file, name, props, result, mocks] of [
  ['config/pages/ModulesSettings.tsx', 'ModulesSettings', { canManage: false }, undefined, { '../useRelatedSettingsEditor': { useRelatedSettingsEditor: () => ({ disabled: false, pending: false }) } }],
  ['config/pages/HrDocumentsSettings.tsx', 'HrDocumentsSettings', {}, undefined, { '../useRelatedSettingsEditor': { useRelatedSettingsEditor: () => ({ disabled: false, pending: false, isCurrent: () => true }) } }],
  ['config/components/OperationalSettingsSection.tsx', 'OperationalSettingsSection', { section: 'caja', values: { cash_closure_denominations: [] }, errors: {}, disabled: true, onField: noop }],
  ['catalogs/components/ProductCategoriesPanel.tsx', 'ProductCategoriesPanel', {}],
  ['catalogs/components/PaymentTermsPanel.tsx', 'PaymentTermsPanel', {}],
  ['catalogs/components/PaymentMethodsTab.tsx', 'PaymentMethodsTab', {}],
  ['catalogs/components/CashRegistersTab.tsx', 'CashRegistersTab', {}, { data: [] }],
]) {
  test(`${name} renders its empty catalog within the existing collection`, () => {
    const { html } = render(file, name, props, { allowed: false, result, mocks })
    assert.ok(html.includes('workspace-flat.png'), `${name} must render illustrated empty collection`)
  })
}

test('status-only filters use search empty state and hide advance creation', () => {
  const { html } = render('hr/pages/AdvancesManagement.tsx', 'AdvancesManagement', { employeeId: 'employee' }, { states: { 2: 'PAGADO' } })
  assert.match(html, /Busquemos por otro lado/)
  assert.match(html, /Limpiar filtros/)
  assert.doesNotMatch(html, /Los anticipos tendrán su espacio/)
})

test('supervisor picker empty result remains compact and supports clearing search', () => {
  const { html } = render('hr/pages/EmployeeSupervisorSelect.tsx', 'EmployeeSupervisorSelect', { onChange: noop, disabled: false }, { states: { 0: 'Ana', 1: 'Ana', 3: true } })
  assert.match(html, /workspace-flat\.png/)
  assert.match(html, /Busquemos por otro lado/)
  assert.match(html, /Limpiar filtros/)
})

test('user list initial action respects create permission', () => {
  const query = ({ queryKey }) => ({ data: queryKey[0] === 'users' ? empty : [], isLoading: false, isFetching: false, error: null, refetch: noop })
  for (const create of [true, false]) {
    const { html } = render('users/UserManagement.tsx', 'default', {}, { allowed: (...p) => p.includes('users.view') || (create && p.includes('users.create')), query })
    assert.match(html, /workspace-flat\.png/)
    assert.match(html, /Aquí empieza tu equipo/)
    assert.equal((html.match(/href="\/usuarios\/nuevo"/g) || []).length, create ? 2 : 0)
  }
})

test('role list identifies an active module filter as search and offers reset', () => {
  const query = ({ queryKey }) => ({ data: queryKey[0] === 'permissions' ? [] : empty, isLoading: false, isFetching: false, error: null, refetch: noop })
  const { html } = render('users/RolesPermissionsManagement.tsx', 'default', {}, { query, states: { 2: 'inventory' } })
  assert.match(html, /Busquemos por otro lado/)
  assert.match(html, /Limpiar filtros/)
})

for (const [file, name, props, options] of [
  ['branches/pages/BranchesManagement.tsx', 'default', {}, { result: { data: [] } }],
  ['hr/pages/AttendanceSheet.tsx', 'AttendanceSheet', {}, {}],
  ['hr/pages/EmployeeRecentActivity.tsx', 'EmployeeRecentActivity', { employeeId: 'employee' }, {}],
  ['payroll/pages/PayrollRunDetail.tsx', 'PayrollRunDetail', {}, { result: { data: { id: 'run', code: 'N-1', name: 'Octubre', status: 'PAGADA', type: 'ORDINARIA', payslips: [], period_start: '2026-10-01', period_end: '2026-10-31', pay_date: '2026-10-31', total_earnings: 0, total_deductions: 0, total_net: 0, total_employer_cost: 0 } } }],
  ['config/components/SettingsNavigation.tsx', 'SettingsNavigation', { active: 'empresa', onSelect: noop }, { states: { 0: 'xyznoexiste' } }],
  ['config/components/PayrollRateSettingsSection.tsx', 'PayrollRateSettingsSection', { context: { canRead: true, canPublish: false }, onActivityChange: noop, canStartOperation: () => true, currency: 'Q' }, { mocks: { '../usePayrollRateDraft': { usePayrollRateDraft: () => ({ data: { items: [], current: { rates: {} } }, draft: {}, errors: {}, dirty: false, busy: false }) } } }],
  ['users/MyProfilePage.tsx', 'default', {}, { result: { data: [] }, mocks: { '@/context/useAuth': { useAuth: () => ({ user: { id: 'user', name: 'Ana', email: 'ana@example.test' } }) } } }],
  ['users/UserDetailPage.tsx', 'default', {}, { states: { 0: { id: 'user', name: 'Ana', email: 'ana@example.test', companies: [], permissions: [] }, 1: false } }],
  ['users/UserTenantAccessCard.tsx', 'UserTenantAccessCard', { userId: 'user', userCompanies: [{ id: 'company', name: 'Empresa' }], canManage: false, onChanged: noop }, { states: { 4: false } }],
]) {
  test(`${file} presents its empty secondary collections without losing its surrounding UI`, () => {
    const { html } = render(file, name, props, options)
    assert.ok(html.includes('workspace-flat.png'), `${file} must render an illustrated collection`)
    if (file.includes('EmployeeRecentActivity')) assert.equal((html.match(/workspace-flat\.png/g) || []).length, 3)
    if (file.includes('UserDetailPage')) assert.equal((html.match(/workspace-flat\.png/g) || []).length, 4)
  })
}

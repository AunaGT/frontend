const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderConfig } = require('./helpers/configViewHarness.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs'), { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('deep linked section exposes only its controls in bounded grouped navigation', () => {
  const { html } = renderConfig()
  assert.match(html, /aria-label="Secciones de configuración"/); assert.match(html, /Se aplica a/)
  assert.match(html, /id="order_validity_days"/); assert.doesNotMatch(html, /id="company_nit"/); assert.doesNotMatch(html, /role="tablist"/)
  assert.match(html, /max-w-\[1560px\]/)
})
test('each existing field group has an addressable section without unrelated inputs', () => {
  for (const [section, field] of [['empresa', 'company_name'], ['regional', 'currency_code'], ['fiscal', 'company_nit'], ['inventario', 'inventory_services_enabled'], ['ventas', 'sales_allow_credit'], ['cotizaciones', 'quote_validity_days'], ['pedidos', 'order_validity_days'], ['caja', 'cash_closure_max_diff_pct']]) assert.match(renderConfig({ section }).html, new RegExp(`id="${field}"`))
})
test('failed or loading configuration never presents editable default fields or save actions', () => {
  for (const status of ['loading', 'error', 'unavailable']) {
    const { html } = renderConfig({ status }); assert.doesNotMatch(html, /id="order_validity_days"/); assert.doesNotMatch(html, />Guardar cambios</)
  }
})
test('inline errors are linked from a focusable summary and the invalid field', () => {
  const { html } = renderConfig({ errors: { pedidos: { order_validity_days: 'Ingresa un entero.' } } })
  assert.match(html, /id="config-errors"[^>]*tabindex="-1"/)
  assert.match(html, /href="#order_validity_days"/); assert.match(html, /aria-invalid="true"/); assert.match(html, /aria-describedby="order_validity_days-error"/)
})
test('fiscal toggle wiring saves its own issuer data without any order keys', async () => {
  const view = renderConfig({ section: 'fiscal', values: { company_nit: 'QA-123', company_address: 'Dirección QA', fel_enabled: 'false' } })
  view.nodes.find(n => n.props.id === 'fel_enabled').props.onCheckedChange(true)
  await view.nodes.find(n => n.type === 'button' && React.Children.toArray(n.props.children).some(c => c === 'Guardar cambios')).props.onClick()
  assert.equal(view.writes[0].fel_enabled, 'true'); assert.equal(view.writes[0].company_nit, 'QA-123'); assert.equal(view.writes[0].company_address, 'Dirección QA')
  assert.equal(view.writes[0].order_validity_days, undefined)
})
test('selector guard reads current activity before render and avoids a second unload prompt after acceptance', () => {
  const previous = global.window, h = hookHarness(), listeners = new Map(), nodes = [], toasts = []
  let guard, answer = false, confirms = 0, params = new URLSearchParams('seccion=pedidos&keep=yes')
  const activity = { dirty: false, pending: false }, model = loadReportModule('../config/settingsModel.ts')
  global.window = { confirm: () => { confirms++; return answer }, addEventListener: (n, cb) => listeners.set(n, cb), removeEventListener: (n, cb) => { if (listeners.get(n) === cb) listeners.delete(n) } }
  const tenant = { company: { id: 'A' }, branch: { id: 'BA' }, registerTenantExitGuard: cb => { guard = cb; return () => { guard = null } } }
  const draft = { status: 'ready', confirmed: {}, drafts: Object.fromEntries(Object.keys(model.SECTION_KEYS).map(id => [id, model.sectionValues(id, {})])), errors: {}, dirty: () => false, pending: false, hasChanges: false, getActivity: () => activity }
  const toast = t => toasts.push(t)
  const Page = loadReportModule('../config/pages/ConfigManagement.tsx', { react: h.hooks, '@/context/useTenant': { useTenant: () => tenant },
    'react-router-dom': { useSearchParams: () => [params, p => { params = p }], useNavigate: () => () => {} },
    '@/components/layout/PageNavigation': { usePageTrail() {} }, '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'U' }, permissionsReady: true, hasPermission: () => true }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ refetch() {} }) }, '@/hooks/use-toast': { useToast: () => ({ toast }) }, '../useSettingsDraft': { useSettingsDraft: () => draft },
    './ModulesSettings': { ModulesSettings: () => null }, './HrDocumentsSettings': { HrDocumentsSettings: () => null },
  }, nodes).default
  try {
    h.render(() => Page()); activity.dirty = true
    assert.equal(guard(), false); assert.equal(confirms, 1)
    let prevented = false; listeners.get('beforeunload')({ preventDefault: () => { prevented = true } }); assert.equal(prevented, true)
    activity.pending = true; answer = true; assert.equal(guard(), false); assert.equal(confirms, 1); assert.equal(toasts.length, 1)
    activity.pending = false; assert.equal(guard(), true); assert.equal(confirms, 2)
    prevented = false; listeners.get('beforeunload')({ preventDefault: () => { prevented = true } }); assert.equal(prevented, false)
    nodes.find(n => n.type?.name === 'SettingsNavigation').props.onSelect('fiscal'); assert.equal(params.get('seccion'), 'fiscal'); assert.equal(params.get('keep'), 'yes')
    h.unmount(); assert.equal(guard, null); assert.equal(listeners.size, 0)
  } finally { global.window = previous }
})

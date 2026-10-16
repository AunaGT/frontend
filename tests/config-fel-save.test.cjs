const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs')
test('real page and draft persist fiscal activation and existing issuer fields together', async () => {
  const h = hookHarness(), nodes = [], writes = [], prior = global.window; global.window = new EventTarget()
  try {
    const params = new URLSearchParams('seccion=fiscal')
  const Page = loadReportModule('../config/pages/ConfigManagement.tsx', {
    '@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['payroll'])})},
      react: h.hooks, 'react-router-dom': { useSearchParams: () => [params, () => {}], useNavigate: () => () => {} },
      '@/components/layout/PageNavigation': { usePageTrail() {} },
      '@/context/useTenant': { useTenant: () => ({ company: { id: 'A', name: 'Empresa A' }, branch: { id: 'BA' }, registerTenantExitGuard: () => () => {} }) },
      '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'U' }, permissionsReady: true, hasPermission: () => true }) },
      '@/hooks/useSystemSettings': { useSystemSettings: () => ({ refetch: async () => true }) }, '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
      '@/services/api': { getActiveCompanyId: () => 'A', getActiveBranchId: () => 'BA' },
      '@/services/settingsService': { getSettings: async () => ({ company_nit: 'QA-123', company_address: 'Dirección QA', fel_enabled: 'false' }), updateSettings: async p => { writes.push(p); return p } },
      './ModulesSettings': { ModulesSettings: () => null }, './HrDocumentsSettings': { HrDocumentsSettings: () => null },
    }, nodes).default
    const render = () => { nodes.length = 0; renderToStaticMarkup(h.render(() => Page())) }
    render(); await new Promise(resolve => setImmediate(resolve)); render()
    nodes.find(n => n.props.id === 'fel_enabled').props.onCheckedChange(true); render()
    await nodes.find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Guardar cambios')).props.onClick()
    assert.equal(writes.length, 1); assert.equal(writes[0].fel_enabled, 'true'); assert.equal(writes[0].company_nit, 'QA-123'); assert.equal(writes[0].company_address, 'Dirección QA')
    h.unmount()
  } finally { global.window = prior }
})

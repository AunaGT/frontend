const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./loadReportModule.cjs')
function renderConfig({ section = 'pedidos', canManage = true, status = 'ready', values = {}, pending = false, errors = {} } = {}) {
  const nodes = [], writes = [], changes = [], resets = [], toasts = [], model = loadReportModule('../config/settingsModel.ts')
  const drafts = Object.fromEntries(Object.keys(model.SECTION_KEYS).map(id => [id, model.sectionValues(id, values)]))
  const draft = { status, confirmed: { company_name: 'Empresa A', ...values }, drafts, errors, pending, hasChanges: false, logoUrl: '', loadError: 'Error de prueba', error: null,
    dirty: () => true, getActivity: () => ({ dirty: draft.hasChanges, pending: draft.pending }), canStartOperation: () => !draft.pending && canManage,
    setField: (id, field, value) => { changes.push({ id, field, value }); drafts[id][field] = value },
    save: async id => { writes.push(model.sectionPayload(id, drafts[id])); return 'saved' }, reset: id => resets.push(id), reload() {}, uploadLogo() {}, removeLogo() {}, reportActivity() {} }
  const Page = loadReportModule('../config/pages/ConfigManagement.tsx', {
    react: React,
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'A', name: 'Empresa A' }, branch: { id: 'BA' }, registerTenantExitGuard: () => () => {} }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ user: { id: 'U' }, permissionsReady: true, hasPermission: (...codes) => canManage || codes.includes('settings.view') }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ refetch: async () => true }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: data => toasts.push(data) }) },
    '@/context/useModules': { useModules: () => ({ isLoading: false, isError: false, enabledModuleCodes: new Set(['appointments', 'inventory', 'catalogs', 'accounting', 'users']) }) },
    '@/services/settingsService': { getSettings: async () => ({}) },
    '../useSettingsDraft': { useSettingsDraft: () => draft },
    './ModulesSettings': { ModulesSettings: () => null }, './HrDocumentsSettings': { HrDocumentsSettings: () => null },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [`/configuracion?seccion=${section}`] }, React.createElement(Page)))
  return { html, nodes, writes, changes, resets, toasts, draft }
}
module.exports = { renderConfig }

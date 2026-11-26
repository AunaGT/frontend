const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { hookHarness } = require('./helpers/reportHookHarness.cjs')
const tick = () => new Promise(resolve => setImmediate(resolve))
function setup({ permissions = ['settings.view', 'settings.manage'], read } = {}) {
  const h = hookHarness(), nodes = [], reads = [], writes = []
  let company = 'A'
  const Page = loadReportModule('../accounting/components/SettingsTab.tsx', {
    react: h.hooks,
    '@/context/useTenant': { useTenant: () => ({ company: { id: company }, branch: { id: `branch-${company}` }, isConsolidated: false }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: (...names) => names.some(name => permissions.includes(name)) }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/api': { apiFetch() { throw Error('No real network') } },
    '@/services/accountingService': { getAccountingConfig: async () => ({ defaults: {}, keys: [], revision: 1 }), getPeriods: async () => ({ items: [] }) },
    '@/services/settingsService': { getSettings: async options => { reads.push(options); return read ? read(options) : { vat_affiliation: 'pequeno_contribuyente', iva_rate: '7.125', pequeno_rate: '0' } }, updateSettings: async (...args) => writes.push(args) },
  }, nodes).SettingsTab
  const render = () => { nodes.length = 0; h.render(() => Page({ accounts: [], canManage: true })); return nodes }
  const texts = () => nodes.flatMap(n => React.Children.toArray(n.props.children).filter(x => typeof x === 'string')).join(' ')
  return { h, reads, writes, render, texts, company: next => { company = next } }
}
test('accounting displays loaded fiscal settings read-only, preserving zero, with one editing destination', async () => {
  const v = setup()
  try {
    v.render(); await tick(); const nodes = v.render()
    assert.match(v.texts(), /Pequeño contribuyente/); assert.match(v.texts(), /7\.125/)
    assert.ok(nodes.some(n => n.type === 'dd' && React.Children.toArray(n.props.children).includes('0')))
    assert.ok(nodes.some(n => n.type === 'a' && n.props.href === '/configuracion?seccion=fiscal'))
    assert.doesNotMatch(v.texts(), /Guardar tasas/)
    assert.equal(nodes.some(n => n.props.type === 'number'), false)
    assert.equal(v.writes.length, 0)
  } finally { v.h.unmount() }
})
test('settings-view permission reads the summary without exposing edit controls', async () => {
  const v = setup({ permissions: ['settings.view'] })
  try {
    v.render(); await tick(); v.render()
    assert.equal(v.reads.length, 1); assert.match(v.texts(), /Pequeño contribuyente/)
    assert.doesNotMatch(v.texts(), /Editar configuración fiscal|Guardar tasas/)
    assert.match(v.texts(), /Ver configuración fiscal/)
  } finally { v.h.unmount() }
})
test('missing permission or failed read never displays invented tax defaults', async () => {
  for (const options of [{ permissions: [] }, { read: async () => { throw Error('Synthetic failure') } }]) {
    const v = setup(options)
    try {
      v.render(); await tick(); v.render()
      assert.ok(!v.texts().includes('12 %')); assert.ok(!v.texts().includes('5 %'))
      assert.match(v.texts(), /permiso|No se pudieron cargar/)
      if (!options.permissions?.length && options.permissions) assert.equal(v.reads.length, 0)
    } finally { v.h.unmount() }
  }
})
test('changing company hides the previous summary immediately and ignores late responses', async () => {
  const pending = []
  const v = setup({ read: () => new Promise(resolve => pending.push(resolve)) })
  try {
    v.render(); v.company('B'); v.render()
    pending[0]({ vat_affiliation: 'general', iva_rate: '8', pequeno_rate: '4' }); await tick(); v.render()
    assert.doesNotMatch(v.texts(), /Régimen general/)
    pending[1]({ vat_affiliation: 'exento', iva_rate: '0', pequeno_rate: '0' }); await tick(); v.render()
    assert.match(v.texts(), /Exento/)
    v.company('A'); v.render(); assert.doesNotMatch(v.texts(), /Exento/)
  } finally { v.h.unmount() }
})

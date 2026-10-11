const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')

const alerts = [{ id: 'qa-alert', title: 'Stock bajo', message: 'Reponer producto', product: 'Agua', category: 'Bebidas',
  type: 'stock_low', typeName: 'Stock bajo', moduleCode: 'inventory', priority: 'high', status: 'active',
  currentStock: 2, minStock: 5, timestamp: '9 oct 2026', localDate: '2026-10-09', timestampIso: '2026-10-09T12:00:00Z', assignedTo: '', assignedToId: undefined }]

function renderAlerts({ canManage = true, states = {} } = {}) {
  let stateIndex = 0
  const nodes = [], changes = [], requests = []
  const Page = loadReportModule('../alerts/pages/AlertsManagement.tsx', {
    react: { ...React, useEffect() {}, useState: initial => {
      const i = stateIndex++
      const values = { 0: alerts, 1: [{ id: 'qa-user', name: 'Responsable' }], 2: false, ...states }
      const [value, setValue] = React.useState(Object.hasOwn(values, i) ? values[i] : initial)
      return [value, next => { changes.push({ index: i, value: typeof next === 'function' ? next(value) : next }); setValue(next) }]
    } },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => canManage }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/services/api': { apiFetch: async path => { requests.push({ path }); return [] } },
    '@/services/productService': { fetchProducts() { throw new Error('No live product reads') } },
    '../api/alertsService': {
      createAlert: async payload => { requests.push({ create: payload }) },
      resolveAlert: async id => { requests.push({ resolve: id }); return { id, title: 'Stock bajo', resolved: true } },
      reassignAlert: async (id, userId) => { requests.push({ assign: id, userId }) },
      fetchAssignableAlertUsers() { throw new Error('No live user reads') },
      fetchAlertTypes() { throw new Error('No live catalog reads') },
      fetchAlertPriorities() { throw new Error('No live catalog reads') },
    },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Page)), nodes, changes, requests }
}

test('alerts use the same bounded page measure as Sales and keep metrics before the toolbar', () => {
  const { html } = renderAlerts()
  assert.match(html, /^<main class="[^"]*mx-auto[^"]*max-w-\[1560px\]/)
  assert.ok(html.indexOf('Resumen de alertas') < html.indexOf('compact-filter-toolbar'))
  assert.ok(html.indexOf('Nueva alerta') < html.indexOf('Listado de alertas'))
  assertPaginationOutside(html)
})

test('table and pagination actions use shared buttons with contextual accessible names', () => {
  const { html } = renderAlerts()
  assert.match(html, /class="[^"]*auna-form-action-outline[^"]*"[^>]*aria-label="Ver Stock bajo"/)
  assert.match(html, /aria-label="Resolver Stock bajo"/)
  assert.match(html, /class="[^"]*auna-form-action[^"]*"[^>]*aria-label="Página anterior"/)
  assert.match(html, /aria-label="Página 1" aria-current="page"/)
})

test('alert actions use an accessible eye and stay aligned on one line', () => {
  const { html } = renderAlerts()
  const cell = html.match(/<td data-label="Acciones"[\s\S]*?<\/td>/)?.[0]
  assert.ok(cell, 'The fixture must render alert actions')
  assert.match(cell, /lucide-eye/)
  assert.match(cell, /aria-label="Ver Stock bajo"/)
  assert.match(cell, /flex-nowrap/)
  assert.doesNotMatch(cell, /flex-wrap/)
  assert.equal((cell.match(/h-10/g) || []).length, 2, 'Eye and Resolve should keep the shared 40px height')
})

test('read-only alerts retain details but hide create, resolve and assignment controls', () => {
  const { html } = renderAlerts({ canManage: false })
  assert.match(html, /Ver Stock bajo/)
  assert.doesNotMatch(html, /Nueva alerta|Resolver Stock bajo|Asignar Stock bajo a/)
})

test('detail and assignment callbacks retain their alert IDs', async () => {
  const { nodes, changes, requests } = renderAlerts()
  nodes.find(n => n.props?.['aria-label'] === 'Ver Stock bajo').props.onClick()
  assert.deepEqual(changes.at(-1), { index: 10, value: 'qa-alert' })
  nodes.find(n => n.props?.['aria-label'] === 'Asignar Stock bajo a').props.onChange({ target: { value: 'qa-user' } })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, [{ assign: 'qa-alert', userId: 'qa-user' }])
  assert.equal(changes.find(c => c.index === 0).value[0].assignedTo, 'Responsable')
})

test('creation retains its validation and original product payload', async () => {
  const states = { 11: true, 14: '3', 15: '2', 16: '  Reponer  ', 17: '  Revisar  ', 20: { id: 'qa-product', name: 'Agua' } }
  const { nodes, requests } = renderAlerts({ states })
  const create = nodes.find(n => n.props?.children?.includes?.(' Crear alerta'))
  assert.equal(create.props.disabled, false)
  create.props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, [{ create: { type_id: 3, priority_id: 2, title: 'Reponer', message: 'Revisar', product_id: 'qa-product' } }, { path: '/api/alerts?all=true' }])
  const incomplete = renderAlerts({ states: { ...states, 20: null } })
  const disabledCreate = incomplete.nodes.find(n => n.props?.children?.includes?.(' Crear alerta'))
  assert.equal(disabledCreate.props.disabled, true)
  disabledCreate.props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(incomplete.requests, [])
})

test('shared pagination preserves page navigation and disabled boundaries', () => {
  const { html, nodes, changes } = renderAlerts()
  assert.match(html, /disabled="" aria-label="Página anterior"/)
  assert.match(html, /disabled="" aria-label="Página siguiente"/)
  nodes.find(n => n.props?.['aria-label'] === 'Página 1').props.onClick()
  assert.deepEqual(changes.at(-1), { index: 6, value: 1 })
})

test('resolving keeps the original date while updating the alert status', async () => {
  const { nodes, requests, changes } = renderAlerts()
  nodes.find(n => n.props?.['aria-label'] === 'Resolver Stock bajo').props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, [{ resolve: 'qa-alert' }])
  const updated = changes.find(c => c.index === 0).value[0]
  assert.equal(updated.status, 'resolved')
  assert.equal(updated.timestamp, '9 oct 2026')
  assert.equal(updated.localDate, '2026-10-09')
})

test('mobile rows are separated by dividers, not individual card frames; shared buttons are not resized locally', async () => {
  const fs = require('node:fs'), path = require('node:path')
  const { root } = await require('postcss')().process(fs.readFileSync(path.join(__dirname, '../src/modules/alerts/pages/alerts.css'), 'utf8'), { from: undefined })
  const rows = [], overrides = []
  root.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.params.includes('700px') && /\.alerts-table (?:tbody > )?tr$/.test(rule.selector)) {
      rule.walkDecls(d => rows.push([d.prop, d.value]))
    }
    if (/\.alerts-actions button/.test(rule.selector)) rule.walkDecls(d => overrides.push(d.prop))
  })
  assert.ok(rows.some(([prop, value]) => prop === 'border-radius' && value === '0'))
  assert.ok(rows.some(([prop, value]) => prop === 'border' && value === '0'))
  assert.ok(!overrides.some(prop => ['height', 'font-size', 'padding-inline', 'background'].includes(prop)))
})

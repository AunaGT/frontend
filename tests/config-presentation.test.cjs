const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

const denominations = [{ denomination: 100, type: 'Billete' }, { denomination: 0.5, type: 'Moneda' }, { denomination: 0, type: 'Billete' }]
function renderConfig({ canManage = true, loading = false, saving = false, tab = 'denominations' } = {}) {
  let stateIndex = 0
  const changes = [], requests = [], nodes = [], toasts = []
  const Page = loadReportModule('../config/pages/ConfigManagement.tsx', {
    react: { ...React, useEffect() {}, useState: initial => {
      const i = stateIndex++
      const overrides = { 0: loading, 1: saving, 2: tab, 7: denominations }
      const [value, setValue] = React.useState(Object.hasOwn(overrides, i) ? overrides[i] : initial)
      return [value, next => { changes.push({ index: i, value: typeof next === 'function' ? next(value) : next }); setValue(next) }]
    } },
    '@/context/useTenant': { useTenant: () => ({ company: { id: 'qa-company' } }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => canManage }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ refetch() {} }) },
    '@/hooks/use-toast': { useToast: () => ({ toast: data => toasts.push(data) }) },
    '@/services/settingsService': { getSettings() { throw new Error('No real settings reads') }, updateSettings: async data => { requests.push(data) }, uploadCompanyLogo() { throw new Error('No real uploads') }, removeCompanyLogo() { throw new Error('No real removals') } },
    './ModulesSettings': { ModulesSettings: () => null },
    './HrDocumentsSettings': { HrDocumentsSettings: () => null },
  }, nodes).default
  const html = renderToStaticMarkup(React.createElement(Page))
  return { html, nodes, changes, requests, toasts }
}

test('configuration shares the bounded page width and module tab components', () => {
  const { html } = renderConfig()
  assert.match(html, /^<div class="[^"]*mx-auto[^"]*max-w-\[1560px\]/)
  assert.match(html, /aria-label="Secciones de configuración"/)
  assert.match(html, /role="tablist"/)
  assert.doesNotMatch(html, /class="config-tabs"/)
})

test('denominations are rows of one embedded table, not individually framed cards', () => {
  const { html } = renderConfig()
  assert.equal((html.match(/<table/g) || []).length, 1)
  assert.match(html, /auna-table-embedded/)
  assert.match(html, /aria-label="Denominaciones para cierre de caja"/)
  assert.match(html, /aria-label="Valor de denominación 1"/)
  assert.match(html, /aria-label="Tipo de denominación 1"/)
  assert.doesNotMatch(html, /config-denomination-row/)
  assert.match(html, /Agregar denominación/)
  assert.match(html, /Guardar denominaciones/)
})

test('existing amount, type, add and remove callbacks preserve denomination state', () => {
  const { nodes, changes } = renderConfig()
  nodes.find(n => n.props?.['aria-label'] === 'Valor de denominación 1').props.onChange({ target: { value: '25.5' } })
  assert.deepEqual(changes.at(-1).value[0], { denomination: 25.5, type: 'Billete' })
  const type = nodes.find(n => n.props?.['aria-label'] === 'Tipo de denominación 1')
  const select = nodes.find(n => n.props?.children?.some?.(child => child === type || child?.props?.['aria-label'] === 'Tipo de denominación 1'))
  assert.ok(select?.props.onValueChange)
  select.props.onValueChange('Moneda')
  assert.deepEqual(changes.at(-1).value[0], { denomination: 100, type: 'Moneda' })
  nodes.find(n => n.props?.children === 'Agregar denominación').props.onClick()
  assert.deepEqual(changes.at(-1).value.at(-1), { denomination: 0, type: 'Billete' })
  nodes.find(n => n.props?.['aria-label'] === 'Quitar denominación 1').props.onClick()
  assert.deepEqual(changes.at(-1).value, denominations.slice(1))
})

test('saving keeps the existing payload and excludes zero values', async () => {
  const { nodes, requests } = renderConfig()
  await nodes.find(n => n.props?.children?.includes?.('Guardar denominaciones')).props.onClick()
  assert.deepEqual(requests, [{ cash_closure_denominations: [{ denomination: 100, type: 'Billete' }, { denomination: 0.5, type: 'Moneda' }] }])
})

test('read-only configuration keeps values visible but has no add, remove or save actions', () => {
  const { html, nodes } = renderConfig({ canManage: false })
  assert.match(html, /value="100"/)
  assert.equal(nodes.find(n => n.props?.['aria-label'] === 'Valor de denominación 1').props.disabled, true)
  assert.doesNotMatch(html, /Agregar denominación|Guardar denominaciones|Quitar denominación/)
})

test('loading configuration retains the same page measure', () => {
  const { html } = renderConfig({ loading: true })
  assert.match(html, /^<main class="[^"]*mx-auto[^"]*max-w-\[1560px\]/)
  assert.match(html, /Cargando configuración/)
})

test('service preference is disabled by default and its switch respects settings permissions', () => {
  const result = renderConfig({ tab: 'general' })
  const toggle = result.nodes.find(n => n.props.id === 'inventory_services_enabled')
  assert.ok(toggle, 'Service preference belongs to the existing company settings')
  assert.equal(toggle.props.checked, false)
  toggle.props.onCheckedChange(true)
  assert.equal(result.changes.at(-1).value.inventory_services_enabled, 'true')
  const readOnly = renderConfig({ tab: 'general', canManage: false })
  assert.equal(readOnly.nodes.find(n => n.props.id === 'inventory_services_enabled').props.disabled, true)
})

test('denomination table scrolls locally and its shared table wrapper does not defeat the sticky header', async () => {
  const fs = require('node:fs'), path = require('node:path')
  const css = fs.readFileSync(path.join(__dirname, '../src/modules/config/pages/config.css'), 'utf8')
  const { root } = await require('postcss')().process(css, { from: undefined })
  const declarations = selector => {
    const values = new Map()
    root.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(declaration => values.set(declaration.prop, declaration.value)) })
    return values
  }
  assert.equal(declarations('.config-denominations-table.auna-data-table-shell').get('overflow'), 'auto')
  assert.equal(declarations('.config-denominations-table > div').get('overflow'), 'visible')
  assert.equal(declarations('.config-denominations-table thead').get('position'), 'sticky')
})

const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderConfig } = require('./helpers/configViewHarness.cjs')
const denominations = [{ denomination: 100, type: 'Billete' }, { denomination: 0.5, type: 'Moneda' }, { denomination: 0, type: 'Billete' }]
const renderCash = options => renderConfig({ section: 'caja', values: { cash_closure_denominations: denominations }, ...options })
test('configuration retains its bounded width and accessible navigation without horizontal tabs', () => {
  const { html } = renderCash()
  assert.match(html, /^<div class="[^"]*mx-auto[^\"]*max-w-\[1560px\]/); assert.match(html, /aria-label="Secciones de configuración"/); assert.doesNotMatch(html, /role="tablist"/)
})
test('fiscal activation remains independent of customer fiscal visibility and starts inactive', async () => {
  const view = renderConfig({ section: 'fiscal' }), toggle = view.nodes.find(n => n.props.id === 'fel_enabled')
  assert.equal(toggle.props.checked, false); toggle.props.onCheckedChange(true)
  assert.equal(view.changes.at(-1).value, 'true'); assert.match(view.html, /Este negocio emitirá facturas electrónicas/)
  assert.equal(renderConfig({ section: 'fiscal', canManage: false }).nodes.find(n => n.props.id === 'fel_enabled').props.disabled, true)
})
test('denominations remain rows in one embedded table, not individually framed cards', () => {
  const { html } = renderCash()
  assert.equal((html.match(/<table/g) || []).length, 1); assert.match(html, /auna-table-embedded/); assert.match(html, /aria-label="Denominaciones para cierre de caja"/)
  assert.match(html, /aria-label="Valor de denominación 1"/); assert.match(html, /aria-label="Tipo de denominación 1"/); assert.doesNotMatch(html, /config-denomination-row/); assert.match(html, /Agregar denominación/); assert.match(html, /Guardar cambios/)
})
test('amount, type, add and remove callbacks preserve their denomination payloads', () => {
  const { nodes, changes } = renderCash()
  nodes.find(n => n.props['aria-label'] === 'Valor de denominación 1').props.onChange({ target: { value: '25.5' } })
  assert.deepEqual(changes.at(-1).value[0], { denomination: 25.5, type: 'Billete' })
  const trigger = nodes.find(n => n.props['aria-label'] === 'Tipo de denominación 1')
  const select = nodes.find(n => n.props.onValueChange && React.Children.toArray(n.props.children).some(child => child?.props?.['aria-label'] === trigger.props['aria-label']))
  select.props.onValueChange('Moneda'); assert.deepEqual(changes.at(-1).value[0], { denomination: 100, type: 'Moneda' })
  nodes.find(n => n.props.children === 'Agregar denominación').props.onClick(); assert.deepEqual(changes.at(-1).value.at(-1), { denomination: 0, type: 'Billete' })
  nodes.find(n => n.props['aria-label'] === 'Quitar denominación 1').props.onClick(); assert.deepEqual(changes.at(-1).value, denominations.slice(1))
})
test('cash section save excludes zero rows and never sends other section keys', async () => {
  const { nodes, writes } = renderCash()
  await nodes.find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Guardar cambios')).props.onClick()
  assert.deepEqual(writes, [{ cash_closure_max_diff_pct: '5', cash_closure_denominations: [{ denomination: 100, type: 'Billete' }, { denomination: 0.5, type: 'Moneda' }] }])
})
test('read-only keeps values visible without add, remove or save actions', () => {
  const { html, nodes } = renderCash({ canManage: false })
  assert.match(html, /value="100"/); assert.equal(nodes.find(n => n.props['aria-label'] === 'Valor de denominación 1').props.disabled, true)
  assert.doesNotMatch(html, /Agregar denominación|>Guardar cambios<|Quitar denominación/)
})
test('loading retains the same content measure', () => {
  const { html } = renderCash({ status: 'loading' }); assert.match(html, /max-w-\[1560px\]/); assert.match(html, /Cargando configuración/)
})
test('service capability starts disabled in Inventory and respects settings permissions', () => {
  const view = renderConfig({ section: 'inventario' }), toggle = view.nodes.find(n => n.props.id === 'inventory_services_enabled')
  assert.equal(toggle.props.checked, false); toggle.props.onCheckedChange(true); assert.equal(view.changes.at(-1).value, 'true')
  assert.equal(renderConfig({ section: 'inventario', canManage: false }).nodes.find(n => n.props.id === 'inventory_services_enabled').props.disabled, true)
})
test('denomination table keeps bounded local scroll and sticky headers', async () => {
  const fs = require('node:fs'), path = require('node:path'), css = fs.readFileSync(path.join(__dirname, '../src/modules/config/pages/config.css'), 'utf8')
  const { root } = await require('postcss')().process(css, { from: undefined })
  const declarations = selector => { const values = new Map(); root.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(d => values.set(d.prop, d.value)) }); return values }
  assert.equal(declarations('.config-denominations-table.auna-data-table-shell').get('overflow'), 'auto')
  assert.equal(declarations('.config-denominations-table > div').get('overflow'), 'visible')
  assert.equal(declarations('.config-denominations-table thead').get('position'), 'sticky')
})

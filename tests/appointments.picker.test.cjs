const test = require('node:test'), assert = require('node:assert/strict')
const React = require('react')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')

const service = { id: 'service', name: 'Servicio existente', available: true, schedulable: true, mode: 'INDIVIDUAL', durationMinutes: 45 }
function picker(items, options = {}) {
  const h = hookHarness(), nodes = [], selected = []
  const { AgendaPicker } = loadReportModule('../appointments/components/AgendaPicker.tsx', {
    react: h.hooks,
    '@/services/api': { apiFetch() { throw new Error('Unexpected network request') }, getActiveCompanyId: () => 'company', getActiveBranchId: () => 'branch' },
    '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ data: { items: items.slice((queryKey[4].page - 1) * 10, queryKey[4].page * 10), totalItems: items.length }, isLoading: false, isError: false, isFetching: false }) },
  }, nodes)
  const render = () => { nodes.length = 0; h.render(() => AgendaPicker({ scope: { companyId: 'company', branchId: 'branch' }, kind: 'services', label: 'Selecciona un servicio', group: false, onSelect: row => selected.push(row), ...options })) }
  render()
  nodes.find(n => n.props.onOpenChange).props.onOpenChange(true)
  render()
  return { nodes, selected, render, unmount: h.unmount, row: id => nodes.find(n => n.props.value === id && n.props.onSelect) }
}
function text(children) {
  return React.Children.toArray(children).map(child => typeof child === 'object' ? text(child.props.children) : String(child)).join(' ')
}

test('existing services without an Agenda profile remain visible, explain configuration and cannot be booked', () => {
  const p = picker([{ ...service, schedulable: false, durationMinutes: null }], { canConfigure: true })
  try {
    const row = p.row('service')
    assert.ok(row, 'the existing catalog service must not disappear')
    assert.equal(row.props.disabled, true)
    assert.match(text(row.props.children), /Servicio existente.*Configurar para recibir citas/)
    row.props.onSelect()
    assert.deepEqual(p.selected, [])
    assert.ok(p.nodes.some(n => n.props.to === '/agenda/configuracion'))
  } finally { p.unmount() }
})

test('a service not enabled in the selected branch is visible with a branch-specific explanation', () => {
  const p = picker([{ ...service, schedulable: false }])
  try {
    assert.equal(p.row('service').props.disabled, true)
    assert.match(text(p.row('service').props.children), /No habilitado para citas en esta sucursal/)
    assert.ok(!p.nodes.some(n => n.props.to === '/agenda/configuracion'), 'configuration navigation requires permission')
  } finally { p.unmount() }
})

test('enabled individual services can be selected while group-only and unavailable services explain their restriction', () => {
  const p = picker([service, { ...service, id: 'group', mode: 'GROUP' }, { ...service, id: 'unavailable', available: false }])
  try {
    assert.equal(p.row('service').props.disabled, false)
    p.row('service').props.onSelect()
    assert.deepEqual(p.selected.map(row => row.id), ['service'])
    assert.equal(p.row('group').props.disabled, true)
    assert.match(text(p.row('group').props.children), /Solo sesiones grupales/)
    assert.equal(p.row('unavailable').props.disabled, true)
    assert.match(text(p.row('unavailable').props.children), /No disponible para venta/)
  } finally { p.unmount() }
})

test('group creation accepts only configured group services, without hiding pending catalog services', () => {
  const p = picker([service, { ...service, id: 'group', mode: 'GROUP' }, { ...service, id: 'pending', schedulable: false, durationMinutes: null }], { group: true })
  try {
    assert.equal(p.row('service').props.disabled, true)
    assert.match(text(p.row('service').props.children), /Solo citas individuales/)
    assert.equal(p.row('group').props.disabled, false)
    p.row('group').props.onSelect()
    assert.deepEqual(p.selected.map(row => row.id), ['group'])
    assert.equal(p.row('pending').props.disabled, true)
    assert.match(text(p.row('pending').props.children), /Configurar para recibir citas/)
  } finally { p.unmount() }
})

test('historical filters and contact selectors do not inherit booking eligibility restrictions', () => {
  for (const options of [{ schedulableOnly: false }, { kind: 'contacts' }]) {
    const p = picker([{ ...service, schedulable: false, available: false, mode: 'GROUP' }], options)
    try {
      assert.equal(p.row('service').props.disabled, false)
      p.row('service').props.onSelect()
      assert.equal(p.selected.length, 1)
    } finally { p.unmount() }
  }
})

test('a page of pending services does not hide the catalog or block an enabled service on the next page', () => {
  const pending = Array.from({ length: 10 }, (_, i) => ({ ...service, id: `pending-${i}`, schedulable: false, durationMinutes: null }))
  const p = picker([...pending, service])
  try {
    assert.ok(p.row('pending-0'))
    assert.equal(p.row('service'), undefined)
    const next = p.nodes.find(n => n.props.children === 'Siguiente')
    assert.equal(next.props.disabled, false)
    next.props.onClick()
    p.render()
    assert.equal(p.row('service').props.disabled, false)
    p.row('service').props.onSelect()
    assert.equal(p.selected[0].id, 'service')
  } finally { p.unmount() }
})

test('an actually empty catalog explains the absence rather than claiming services are not enabled', () => {
  const p = picker([], { canConfigure: true })
  try {
    assert.ok(p.nodes.some(n => n.props?.title === 'El próximo servicio aparecerá aquí'))
    assert.ok(!p.nodes.some(n => n.props.to === '/agenda/configuracion'))
  } finally { p.unmount() }
})

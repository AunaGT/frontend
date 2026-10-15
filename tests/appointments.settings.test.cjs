const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('duración solo cambia su regla, conserva unidad y precisión fuera del perfil', () => {
  const nodes = [], writes = []
  const { ServiceScheduleFields, defaultProfile } = loadReportModule('../appointments/components/ServiceScheduleFields.tsx', {}, nodes)
  const html = renderToStaticMarkup(React.createElement(ServiceScheduleFields, { value: { ...defaultProfile, enabled: true }, onChange: v => writes.push(v), disabled: false, directory: { providers: [], resources: [], branches: [] }, errors: {} }))
  assert.match(html, /cita/i); assert.doesNotMatch(html, /Stock inicial|Proveedor obligatorio/)
  nodes.find(n => n.props.id === 'agenda-durationMinutes' && n.props.onChange).props.onChange({ target: { value: '60' } })
  assert.equal(writes[0].durationMinutes, 60)
  assert.equal(Object.hasOwn(writes[0], 'service_unit_label'), false)
})

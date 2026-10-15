const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('lugar externo muestra dirección y traslados con controles globales',()=>{
  const nodes=[],{AgendaVenueFields}=loadReportModule('../appointments/components/AgendaVenueFields.tsx',{},nodes)
  let next
  const html=renderToStaticMarkup(React.createElement(AgendaVenueFields,{value:{venue:{kind:'HOME',address:'Casa'},outboundMinutes:30,returnMinutes:45},onChange:v=>{next=v}}))
  assert.match(html,/Dirección/);assert.match(html,/Traslado de ida/);assert.match(html,/Regreso/)
  const input=nodes.find(n=>n.props?.id==='agenda-venue-address'&&n.props.onChange)
  input.props.onChange({target:{value:'Otra dirección'}})
  assert.equal(next.venue.address,'Otra dirección');assert.equal(next.outboundMinutes,30)
})

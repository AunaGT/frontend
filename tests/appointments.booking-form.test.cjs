const test=require('node:test'),assert=require('node:assert/strict')
const {renderAppointmentPage}=require('./helpers/appointmentsFormHarness.cjs')
const {creationHarness}=require('./helpers/agendaCreationHarness.cjs')
function fill(h){const v=h.render().value;h.change({...v,kind:'SERVICE',productId:'p',contactId:'c',service:{id:'p',name:'Consulta',mode:'INDIVIDUAL',durationPolicy:'FIXED',durationMinutes:45},activity:{...v.activity,startsAt:'2030-01-01T15:00:00.000Z',endsAt:'2030-01-01T15:45:00.000Z',providerIds:['professional'],notes:'Conservar observación'}})}
test('booking form forwards configuration access to the service picker',()=>{
  const page=renderAppointmentPage()
  assert.equal(page.rerender().nodes.find(n=>n.type.name==='AgendaPicker'&&n.props.kind==='services').props.canConfigure,true)
})
test('guardado exitoso sale al detalle sin pedir descartar el borrador ya guardado',async()=>{
  const page=creationHarness({api:async()=>({id:'created'})});fill(page)
  await page.render().save()
  assert.deepEqual(page.saved,[{row:{id:'created'},kind:'BOOKING'}])
})
test('guardado real conserva borrador y clave tras error y bloquea doble envío',async()=>{
  const writes=[];let finish
  const page=creationHarness({api:async(path,body)=>{writes.push({path,body});return new Promise((resolve,reject)=>{finish=()=>reject(Error('Sin conexión'))})}});fill(page)
  const first=page.render().save();await page.render().save();assert.equal(writes.length,1);finish();await first
  assert.equal(page.render().value.activity.notes,'Conservar observación');assert.equal(page.render().value.contactId,'c')
  assert.match(page.render().error,/Sin conexión/)
  const retry=page.render().save();finish();await retry
  assert.equal(writes[0].body.idempotencyKey,writes[1].body.idempotencyKey)
  assert.equal(writes.some(w=>w.path.includes('/sales')),false)
})

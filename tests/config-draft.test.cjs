const test = require('node:test'), assert = require('node:assert/strict')
const { configHarness, deferred, flush } = require('./helpers/configHarness.cjs')
const A = { userId: 'U', companyId: 'A', branchId: 'BA', ready: true, canRead: true, canManage: true, consolidated: false }
async function ready(service = {}, context = A) {
  const writes = [], h = configHarness({ getSettings: async () => ({ order_validity_days: '7', company_nit: 'ORIGINAL', company_name: 'Empresa A' }), updateSettings: async (p, o) => { writes.push([p, o]); return p }, ...service }, context)
  h.render(); await flush(); h.render(); return { h, writes }
}
function change(h, section = 'pedidos', key = 'order_validity_days', value = '12') { h.value().setField(section, key, value); h.render() }
test('confirming one section cannot clear or overwrite another draft from a full response', async () => {
  const { h, writes } = await ready({ updateSettings: async p => ({ ...p, company_nit: 'ORIGINAL' }) })
  change(h, 'fiscal', 'company_nit', 'BORRADOR'); change(h)
  assert.equal(await h.value().save('pedidos'), 'saved'); h.render()
  assert.equal(h.value().drafts.fiscal.company_nit, 'BORRADOR'); assert.equal(h.value().dirty('fiscal'), true); assert.equal(h.value().dirty('pedidos'), false)
  h.value().reset('fiscal'); h.render(); assert.equal(h.value().drafts.fiscal.company_nit, 'ORIGINAL'); h.unmount()
})
test('double click acquires one synchronous operation and sends captured section keys', async () => {
  const pending = deferred(), writes = [], { h } = await ready({ updateSettings: (p, options) => { writes.push([p, options]); return pending.promise } })
  change(h); const first = h.value().save('pedidos'), second = h.value().save('pedidos')
  assert.equal(await second, 'ignored'); assert.equal(writes.length, 1)
  assert.deepEqual(writes[0], [{ order_validity_days: '12' }, { scope: { companyId: 'A', branchId: 'BA' } }])
  pending.resolve({ order_validity_days: '12' }); assert.equal(await first, 'saved'); h.unmount()
})
test('failed load, missing identity, read-only and consolidated never write defaults', async () => {
  for (const context of [{ ...A, canManage: false }, { ...A, consolidated: true, branchId: 'all' }, { ...A, ready: false }, { ...A, userId: '' }, { ...A, companyId: '' }, { ...A, canRead: false, canManage: false }]) {
    const { h, writes } = await ready({}, context); change(h); assert.equal(await h.value().save('pedidos'), 'ignored'); assert.equal(writes.length, 0); h.unmount()
  }
  const { h, writes } = await ready({ getSettings: async () => { throw new Error('Offline') } })
  assert.equal(h.value().status, 'error'); change(h); assert.equal(await h.value().save('pedidos'), 'ignored'); assert.equal(writes.length, 0); h.unmount()
})
test('validation and persistence failure preserve drafts, and confirmed save is not retried after refresh failure', async () => {
  const { h, writes } = await ready({ refresh: async () => false }); change(h, 'pedidos', 'order_validity_days', '1.5')
  assert.equal(await h.value().save('pedidos'), 'invalid'); assert.equal(writes.length, 0)
  change(h); assert.equal(await h.value().save('pedidos'), 'saved-refresh-failed'); h.render()
  assert.equal(h.value().dirty('pedidos'), false); assert.equal(writes.length, 1); assert.equal(await h.value().save('pedidos'), 'ignored'); h.unmount()
  const failed = await ready({ updateSettings: async () => { throw new Error('No se pudo guardar') } }); change(failed.h)
  assert.equal(await failed.h.value().save('pedidos'), 'failed'); failed.h.render(); assert.equal(failed.h.value().drafts.pedidos.order_validity_days, '12'); assert.equal(failed.h.value().dirty('pedidos'), true); failed.h.unmount()
})
test('A to B to A rejects old handlers and late success or failure, including after refresh', async () => {
  for (const reject of [false, true]) {
    const done = deferred(), { h } = await ready({ updateSettings: () => done.promise }); change(h)
    const old = h.value(), pending = old.save('pedidos')
    h.context({ ...A, companyId: 'B', branchId: 'BB' }); h.render(); await flush(); h.render()
    h.context(A); h.render(); await flush(); h.render()
    old.setField('pedidos', 'order_validity_days', '99'); old.reset('pedidos'); assert.equal(await old.save('pedidos'), 'ignored')
    reject ? done.reject(new Error('privado A')) : done.resolve({ order_validity_days: '99' })
    assert.equal(await pending, 'ignored'); h.render(); assert.equal(h.value().drafts.pedidos.order_validity_days, '7'); assert.equal(h.value().error, null); h.unmount()
  }
  const refresh = deferred(), { h } = await ready({ refresh: () => refresh.promise }); change(h); const pending = h.value().save('pedidos'); await flush()
  h.context({ ...A, userId: 'V' }); h.render(); refresh.resolve(true); assert.equal(await pending, 'ignored'); h.unmount()
})
test('late load and logo responses cannot rehydrate a different generation or clear the name draft', async () => {
  const requests = [], h = configHarness({ getSettings: () => { const d = deferred(); requests.push(d); return d.promise } }, A)
  h.render(); h.context({ ...A, userId: 'V' }); h.render(); requests[1].resolve({ company_name: 'V' }); await flush(); requests[0].resolve({ company_name: 'U' }); await flush(); h.render()
  assert.equal(h.value().confirmed.company_name, 'V'); h.unmount()
  const logo = deferred(), current = await ready({ uploadCompanyLogo: () => logo.promise }); change(current.h, 'empresa', 'company_name', 'Nombre pendiente')
  const pending = current.h.value().uploadLogo(new Blob(['image'])); logo.resolve({ company_logo_url: 'https://logo.invalid/a.png' }); assert.equal(await pending, 'saved'); current.h.render()
  assert.equal(current.h.value().drafts.empresa.company_name, 'Nombre pendiente'); assert.equal(current.h.value().dirty('empresa'), true); assert.equal(current.h.value().logoUrl, 'https://logo.invalid/a.png'); current.h.unmount()
})
test('unmount and forced cross-tab session changes invalidate pending operations immediately', async () => {
  const prior = global.window, target = new EventTarget(); global.window = target
  try {
    for (const type of ['storage', 'auth:unauthorized']) {
      const done = deferred(), { h } = await ready({ updateSettings: () => done.promise }); change(h); const old = h.value(), pending = old.save('pedidos')
      const event = new Event(type); Object.defineProperty(event, 'key', { value: 'auth:user' }); target.dispatchEvent(event)
      done.resolve({ order_validity_days: '99' }); assert.equal(await pending, 'ignored'); assert.equal(await old.save('pedidos'), 'ignored'); h.render(); assert.equal(h.value().status, 'unavailable'); h.unmount()
    }
    const done = deferred(), { h } = await ready({ updateSettings: () => done.promise }); change(h); const pending = h.value().save('pedidos'); h.unmount(); done.resolve({ order_validity_days: '99' }); assert.equal(await pending, 'ignored')
  } finally { global.window = prior }
})
test('related dirty activity participates in the guard without being reset by another save', async () => {
  const { h } = await ready(); h.value().reportActivity('rrhh', { dirty: true, pending: false }); h.render(); assert.equal(h.value().hasChanges, true)
  change(h); assert.equal(await h.value().save('pedidos'), 'saved'); h.render(); assert.equal(h.value().hasChanges, true)
  h.value().reportActivity('rrhh', { dirty: true, pending: true }); change(h); assert.equal(await h.value().save('pedidos'), 'ignored'); h.unmount()
})
test('an accidental reload cannot silently discard a dirty section', async () => {
  const { h } = await ready(); change(h); await h.value().reload(); await flush(); h.render()
  assert.equal(h.value().drafts.pedidos.order_validity_days, '12'); assert.equal(h.value().dirty('pedidos'), true); h.unmount()
})
test('cash tolerance saves without configured denominations and omits unfinished zero rows', async () => {
  const { h, writes } = await ready()
  change(h, 'caja', 'cash_closure_max_diff_pct', '10')
  change(h, 'caja', 'cash_closure_denominations', [{ denomination: 0, type: 'Billete' }])
  assert.equal(await h.value().save('caja'), 'saved')
  assert.deepEqual(writes[0][0], { cash_closure_max_diff_pct: '10', cash_closure_denominations: [] })
  h.render(); assert.equal(h.value().dirty('caja'), false); h.unmount()
})

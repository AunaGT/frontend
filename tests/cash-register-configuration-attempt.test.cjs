const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const receipt = extra => ({ id: 'r', revision: 1, command_id: 'receipt', replayed: false, name: 'Caja', code: 'CAJA', active: true, is_default: false, authorized_users: [], legacy_suggested_users: [], ...extra })
function fixture() {
  const rows = new Map(), storage = { getItem: k => rows.get(k) || null, setItem: (k,v) => rows.set(k,v), removeItem: k => rows.delete(k) }
  const mod = loadReportModule('../catalogs/hooks/useCashRegisterConfiguration.ts', { '@/services/cashSessionsService': {} })
  const scope = { companyId: 'c', branchId: 'b', actorId: 'u' }
  return { ...mod, scope, storage }
}
test('double submit shares one persisted command; success requires a readable receipt', async () => {
  const { createRegisterConfigurationAttempt, storage, scope } = fixture()
  const attempt = createRegisterConfigurationAttempt(scope, storage); let finish, calls = 0
  const send = input => { calls++; return new Promise(resolve => { finish = () => resolve(receipt({ name: input.name })) }) }
  const a = attempt.save({ name: 'Caja', code: 'CAJA' }, send), b = attempt.save({ name: 'Caja', code: 'CAJA' }, send)
  assert.equal(calls, 1); assert.ok(attempt.pending()); finish()
  assert.deepEqual(await a, await b); assert.equal(attempt.pending(), null)
})
test('lost or malformed responses followed by 403 preserve the exact attempt after reopening', async () => {
  const { createRegisterConfigurationAttempt, storage, scope } = fixture()
  const first = createRegisterConfigurationAttempt(scope, storage); let original
  await assert.rejects(first.save({ name: 'Caja', code: 'CAJA' }, async input => { original = input; throw new Error('Respuesta perdida') }))
  const reopened = createRegisterConfigurationAttempt(scope, storage)
  await assert.rejects(reopened.save({ name: 'No reemplazar', code: 'OTRA' }, async input => { assert.deepEqual(input, original); throw Object.assign(new Error('Permiso revocado'), { status: 403 }) }))
  assert.deepEqual(reopened.pending().input, original)
  await assert.rejects(reopened.save({}, async () => ({ id: 'r' })))
  assert.deepEqual(reopened.pending().input, original)
  const other = createRegisterConfigurationAttempt({ ...scope, branchId: 'otra' }, storage)
  assert.equal(other.pending(), null)
  await reopened.save({}, async () => receipt({ revision: 2, replayed: true }))
  assert.equal(reopened.pending(), null)
})
test('a first definitive validation rejection releases the attempt, not a previously uncertain one', async () => {
  const { createRegisterConfigurationAttempt, storage, scope } = fixture(), attempt = createRegisterConfigurationAttempt(scope, storage)
  await assert.rejects(attempt.save({ name: '' }, async () => { throw Object.assign(new Error('Nombre'), { status: 400 }) }))
  assert.equal(attempt.pending(), null)
})
test('a superficially successful but incomplete receipt cannot erase the recovery command', async () => {
  const { createRegisterConfigurationAttempt, storage, scope } = fixture(), attempt = createRegisterConfigurationAttempt(scope, storage)
  await assert.rejects(attempt.save({ name: 'Caja', code: 'CAJA' }, async () => ({ id: 'r', revision: 1, command_id: 'receipt', replayed: false })))
  assert.ok(attempt.pending())
})
test('configuration hook never exposes the prior company draft while the new scope loads', async () => {
  const { hookHarness } = require('./helpers/reportHookHarness.cjs'), h = hookHarness(), rows = new Map()
  const previous = global.sessionStorage
  global.sessionStorage = { getItem: key => rows.get(key) || null, setItem: (key,value) => rows.set(key,value), removeItem: key => rows.delete(key) }
  const record = { id: 'r', name: 'Caja privada A', code: 'A', currency_code: 'GTQ', active: true, is_default: false, revision: 2, authorized_users: [{ id: 'private-user', name: 'Persona de A', active: true }] }
  let resolveB
  const { useCashRegisterConfiguration } = loadReportModule('../catalogs/hooks/useCashRegisterConfiguration.ts', { react: h.hooks, '@/services/cashSessionsService': { fetchCashRegisterConfiguration: async (_, scope) => scope.companyId === 'A' ? record : new Promise(resolve => { resolveB = resolve }) } })
  try {
    let context = { companyId: 'A', branchId: 'a', actorId: 'u', id: 'r' }
    h.render(() => useCashRegisterConfiguration(context)); await new Promise(setImmediate)
    let view = h.render(() => useCashRegisterConfiguration(context))
    assert.equal(view.draft.name, record.name)
    view.setDraft(prev => ({ ...prev, name: 'Borrador de A' }))
    h.render(() => useCashRegisterConfiguration(context))
    context = { companyId: 'B', branchId: 'b', actorId: 'u', id: 'r' }
    view = h.render(() => useCashRegisterConfiguration(context))
    assert.equal(view.record, null); assert.equal(view.draft.name, '')
    await new Promise(setImmediate)
    resolveB({ ...record, name: 'Caja B', authorized_users: [] }); await new Promise(setImmediate)
    view = h.render(() => useCashRegisterConfiguration(context))
    assert.equal(view.draft.name, 'Caja B')
    const bDraft = [...rows.entries()].find(([key]) => key.startsWith('auna:cash-configuration:draft:') && key.includes('"B"'))
    assert.equal(bDraft?.[1].includes('Borrador de A') ?? false, false)
  } finally { h.unmount(); if (previous === undefined) delete global.sessionStorage; else global.sessionStorage = previous }
})
test('read-only configuration ignores and never overwrites an unconfirmed editor draft', async () => {
  const { hookHarness } = require('./helpers/reportHookHarness.cjs'), h = hookHarness(), rows = new Map()
  const previous = global.sessionStorage, key = 'auna:cash-configuration:draft:'+JSON.stringify(['c','b','u','r'])
  const unsaved = JSON.stringify({ revision: 1, draft: { name: 'NO GUARDADA', code: 'OLD', authorizedUserIds: ['removed'] } })
  rows.set(key, unsaved)
  global.sessionStorage = { getItem: k => rows.get(k) || null, setItem: (k,v) => rows.set(k,v), removeItem: k => rows.delete(k) }
  const actual = receipt({ name: 'Caja real', authorized_users: [{ id: 'current', name: 'Ana', active: true }] })
  const { useCashRegisterConfiguration } = loadReportModule('../catalogs/hooks/useCashRegisterConfiguration.ts', { react: h.hooks, '@/services/cashSessionsService': { fetchCashRegisterConfiguration: async () => actual } })
  try {
    const scope = { companyId: 'c', branchId: 'b', actorId: 'u', id: 'r', readOnly: true }
    h.render(() => useCashRegisterConfiguration(scope)); await new Promise(setImmediate)
    const view = h.render(() => useCashRegisterConfiguration(scope))
    assert.equal(view.draft.name, actual.name); assert.deepEqual(view.draft.authorizedUserIds, ['current'])
    assert.equal(rows.get(key), unsaved); assert.equal(await view.save(), null)
  } finally { h.unmount(); if (previous === undefined) delete global.sessionStorage; else global.sessionStorage = previous }
})
test('corrupt storage is visibly blocked rather than offering a successful-looking no-op retry', async () => {
  const { hookHarness } = require('./helpers/reportHookHarness.cjs'), h = hookHarness(), rows = new Map()
  const previous = global.sessionStorage, key = 'auna:cash-configuration:draft:'+JSON.stringify(['c','b','u','r'])
  rows.set(key, '{broken')
  global.sessionStorage = { getItem: k => rows.get(k) || null, setItem: (k,v) => rows.set(k,v), removeItem: k => rows.delete(k) }
  let calls = 0
  const { useCashRegisterConfiguration } = loadReportModule('../catalogs/hooks/useCashRegisterConfiguration.ts', { react: h.hooks, '@/services/cashSessionsService': { fetchCashRegisterConfiguration: async () => receipt({}), saveCashRegisterConfiguration: async () => { calls++; return receipt({}) } } })
  try {
    const scope = { companyId: 'c', branchId: 'b', actorId: 'u', id: 'r' }
    h.render(() => useCashRegisterConfiguration(scope)); let view = h.render(() => useCashRegisterConfiguration(scope))
    assert.equal(view.recoveryBlocked, true); const error = view.error
    await view.loadCurrent(false); await new Promise(setImmediate)
    view = h.render(() => useCashRegisterConfiguration(scope))
    assert.equal(view.error, error); assert.equal(await view.save(), null); assert.equal(calls, 0)
    assert.equal(rows.get(key), '{broken')
  } finally { h.unmount(); if (previous === undefined) delete global.sessionStorage; else global.sessionStorage = previous }
})

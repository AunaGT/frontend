const test = require('node:test')
const assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

function restore(saved, options = {}) {
  const key = 'deposito:listUi:v1:qa-list'
  const entries = new Map(saved === undefined ? [] : [[key, JSON.stringify(saved)]])
  const original = global.sessionStorage
  const effects = []
  global.sessionStorage = { getItem: name => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) }
  try {
    const hook = loadReportModule('../../hooks/usePersistedListUiState.ts', {
      react: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect: effect => effects.push(effect), useRef: value => ({ current: value }) },
    }).usePersistedListUiState
    const state = hook('qa-list', options)
    effects.forEach(effect => effect())
    return { state, stored: JSON.parse(entries.get(key)) }
  } finally { global.sessionStorage = original }
}

const inventoryOptions = { defaultPageSize: 10, defaultView: 'cards', pageSizeOptions: [10, 20, 30, 40] }

test('obsolete inventory size resets before its first request and preserves view and unrelated preferences', () => {
  const result = restore({ page: 6, pageSize: 18, view: 'table', salesPages: { completed: 3 } }, inventoryOptions)
  assert.equal(result.state.pageSize, 10)
  assert.equal(result.state.page, 1)
  assert.equal(result.state.viewMode, 'table')
  assert.deepEqual(result.stored, { page: 1, pageSize: 10, view: 'table', salesPages: { completed: 3 } })
})

test('valid inventory sizes and their restored pages are retained', () => {
  for (const size of inventoryOptions.pageSizeOptions) {
    const { state } = restore({ page: 3, pageSize: size }, inventoryOptions)
    assert.equal(state.pageSize, size)
    assert.equal(state.page, 3)
  }
})

test('main lists start at fifty without overriding detail defaults or saved preferences', () => {
  assert.equal(restore().state.pageSize, 50)
  assert.equal(restore(undefined, { defaultPageSize: 10 }).state.pageSize, 10)
  assert.equal(restore({ pageSize: 10 }).state.pageSize, 10)
  assert.equal(restore(undefined, { defaultPageSize: 20 }).state.pageSize, 20)
  assert.equal(restore({ pageSize: 18, page: 2 }, { defaultPageSize: 20 }).state.pageSize, 18)
  assert.equal(restore(undefined, inventoryOptions).state.viewMode, 'cards')
})

test('malformed or unsupported stored sizes recover without affecting other list keys', () => {
  for (const size of [0, -1, 'not-a-number', 15]) {
    const { state } = restore({ page: 9, pageSize: size }, inventoryOptions)
    assert.equal(state.pageSize, 10)
    assert.equal(state.page, 1)
  }
})

test('size preferences belong to the signed-in user and list, and survive a new session', () => {
  const originals = { localStorage: global.localStorage, sessionStorage: global.sessionStorage }
  const local = new Map(), session = new Map()
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) })
  global.localStorage = storage(local); global.sessionStorage = storage(session)
  const { readListUiPersisted: read, writeListUiPersisted: write } = loadReportModule('../../hooks/usePersistedListUiState.ts')
  try {
    local.set('auth:user', JSON.stringify({ id: 'A' }))
    write('inventory', { page: 3, pageSize: 25, cardMultiple: 2, cardPageSize: 60 })
    assert.equal(read('inventory').pageSize, 25)
    assert.equal(read('contacts').pageSize, undefined)
    local.set('auth:user', JSON.stringify({ id: 'B' }))
    assert.equal(read('inventory').pageSize, undefined, 'A second user starts with their own defaults')
    write('inventory', { pageSize: 100, cardMultiple: 4 })
    local.set('auth:user', JSON.stringify({ id: 'A' })); session.clear()
    assert.equal(read('inventory').pageSize, 25)
    assert.equal(read('inventory').cardMultiple, 2)
    assert.equal(read('inventory').cardPageSize, 60)
    assert.equal(read('inventory').page, undefined, 'Only preference, not a stale page, survives a new session')
  } finally { Object.assign(global, originals) }
})

test('standard table preferences accept 25/50/100 and reject obsolete or oversized saved sizes', () => {
  for (const size of [10, 25, 50, 100]) assert.equal(restore({ pageSize: size }).state.pageSize, size)
  for (const size of [8, 18, 20, 1000]) {
    const { state } = restore({ page: 4, pageSize: size })
    assert.equal(state.pageSize, 50)
    assert.equal(state.page, 1)
  }
})

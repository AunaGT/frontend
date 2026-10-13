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

test('new lists default to ten without overriding explicit defaults or unrestricted saved preferences', () => {
  assert.equal(restore().state.pageSize, 10)
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

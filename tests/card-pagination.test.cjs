const test = require('node:test')
const assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

function harness(initial = { enabled: true, tablePageSize: 25 }) {
  const values = [], effects = [], deps = []
  let index = 0, callback, disconnected = 0
  const pages = []
  const previousObserver = global.ResizeObserver
  global.ResizeObserver = class {
    constructor(run) { callback = run }
    observe() {}
    disconnect() { disconnected++ }
  }
  const useCardPagination = loadReportModule('../../hooks/useCardPagination.ts', { react: {
    useState(value) { const i = index++; if (!(i in values)) values[i] = typeof value === 'function' ? value() : value; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next }] },
    useRef(value) { const i = index++; return values[i] ??= { current: value } },
    useCallback: fn => fn,
    useEffect(run, next) { const i = index++; if (!deps[i] || next.some((value, key) => value !== deps[i][key])) { deps[i] = next; effects.push(run) } },
  } }).useCardPagination
  let props = initial
  const render = (patch = {}) => { index = 0; props = { ...props, ...patch }; const result = useCardPagination({ ...props, onPageChange: page => pages.push(page) }); while (effects.length) effects.shift()(); return result }
  return { render, pages, resize: width => callback([{ contentRect: { width } }]), cleanup: () => { global.ResizeObserver = previousObserver }, disconnected: () => disconnected }
}

test('card pages fill measured rows, preserve selected multiples on resize and restore table size', () => {
  const h = harness()
  try {
    let state = h.render()
    state.containerRef({ clientWidth: 1000 })
    state = h.render()
    assert.equal(state.pageSize, 12)
    assert.deepEqual(state.pageSizeOptions, [12, 24, 36, 48])
    state.setCardPageSize(24)
    assert.equal(h.render().pageSize, 24)
    h.resize(650)
    assert.equal(h.render().pageSize, 20)
    assert.deepEqual(h.render().pageSizeOptions, [10, 20, 30, 40])
    assert.equal(h.render({ enabled: false }).pageSize, 25)
    assert.ok(h.pages.every(page => page === 1))
    assert.ok(h.pages.length >= 3)
    state.containerRef(null)
    assert.ok(h.disconnected() > 0)
  } finally { h.cleanup() }
})

test('hidden mobile cards keep table size, visible cards and narrow widths fill one row safely', () => {
  const h = harness({ enabled: true, tablePageSize: 10 })
  try {
    let state = h.render()
    state.containerRef({ clientWidth: 0 })
    state = h.render()
    assert.equal(state.pageSize, 10)
    h.resize(310)
    state = h.render()
    assert.deepEqual(state.pageSizeOptions, [10, 20, 30, 40])
    state.setCardPageSize(11)
    assert.equal(h.render().pageSize, 10, 'Unsupported sizes are not accepted')
    h.resize(1320)
    assert.equal(h.render().pageSize, 12)
    assert.deepEqual(h.render().pageSizeOptions, [12, 24, 36, 48])
  } finally { h.cleanup() }
})

test('card default is valid before measuring, even when the stored table size is not a card option', () => {
  const h = harness({ enabled: true, tablePageSize: 25 })
  try {
    const state = h.render()
    assert.equal(state.pageSize, 10)
    assert.ok(state.pageSizeOptions.includes(state.pageSize))
  } finally { h.cleanup() }
})

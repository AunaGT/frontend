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

test('cards load about forty records in complete rows and expose supported choices', () => {
  const h = harness()
  try {
    let state = h.render()
    assert.equal(state.pageSize, 40)
    state.containerRef({ clientWidth: 1000 })
    state = h.render()
    assert.equal(state.pageSize, 42)
    assert.deepEqual(state.pageSizeOptions, [21, 42, 60, 81, 99])
    state.setCardPageSize(60)
    assert.equal(h.render().pageSize, 60)
    h.resize(650)
    assert.equal(h.render().pageSize, 60)
    assert.deepEqual(h.render().pageSizeOptions, [20, 40, 60, 80, 100])
    assert.equal(h.render({ enabled: false }).pageSize, 25)
    state.containerRef(null)
    assert.ok(h.disconnected() > 0)
  } finally { h.cleanup() }
})

test('hidden cards retain table size and height-only resizing does not reset pagination', () => {
  const h = harness({ enabled: true, tablePageSize: 50 })
  try {
    h.render().containerRef({ clientWidth: 0 })
    assert.equal(h.render().pageSize, 50)
    h.resize(1320)
    const state = h.render(), changes = h.pages.length
    assert.equal(state.pageSize, 40)
    state.setCardPageSize(11)
    assert.equal(h.render().pageSize, 40)
    h.resize(1320)
    assert.equal(h.render().pageSize, 40)
    assert.equal(h.pages.length, changes)
  } finally { h.cleanup() }
})

test('compact POS tiles paginate using their actual width without changing standard cards',()=>{
 const h=harness({enabled:true,tablePageSize:9,cardMinWidth:140,cardGap:10})
 try{
  h.render().containerRef({clientWidth:600})
  let value=h.render();assert.equal(value.columns,4);assert.equal(value.pageSize,40)
  h.resize(760);value=h.render();assert.equal(value.columns,5);assert.ok(value.pageSizeOptions.every(n=>n%5===0))
 }finally{h.cleanup()}
})

test('wide pages round forty to full rows and preserve a manually chosen quantity across widths', () => {
  const h = harness()
  try {
    h.render().containerRef({ clientWidth: 2496 })
    let state = h.render()
    assert.equal(state.pageSize, 42)
    assert.deepEqual(state.pageSizeOptions, [21, 42, 63, 84, 98])
    state.setCardPageSize(63)
    h.resize(1856)
    state = h.render()
    assert.equal(state.pageSize, 65)
    assert.deepEqual(state.pageSizeOptions, [20, 40, 60, 65, 80, 100])
    assert.equal(h.render({ enabled: false }).pageSize, 25)
  } finally { h.cleanup() }
})

test('legacy card preferences stay separate and new choices restore after reopening', () => {
  const original = global.sessionStorage
  const entries = new Map([['deposito:listUi:v1:contacts', JSON.stringify({ pageSize: 25, cardMultiple: 3 })]])
  global.sessionStorage = { getItem: k => entries.get(k) ?? null, setItem: (k,v) => entries.set(k,v) }
  const h = harness({ enabled: true, tablePageSize: 25, storageKey: 'contacts' })
  try {
    h.render().containerRef({ clientWidth: 1000 })
    let state = h.render()
    assert.equal(state.pageSize, 36)
    assert.ok(state.pageSizeOptions.includes(36))
    state.setCardPageSize(60)
    assert.equal(h.render().pageSize, 60)
    const saved = JSON.parse(entries.get('deposito:listUi:v1:contacts'))
    assert.equal(saved.cardPageSize, 60)
    assert.equal(saved.pageSize, 25)
    const next = harness({ enabled: true, tablePageSize: 25, storageKey: 'contacts' })
    try { next.render().containerRef({ clientWidth: 1320 }); assert.equal(next.render().pageSize, 60) } finally { next.cleanup() }
    assert.equal(h.render({ enabled: false }).pageSize, 25)
  } finally { h.cleanup(); global.sessionStorage = original }
})

test('all card choices stay bounded and complete rows on ultrawide displays', () => {
  const h = harness()
  try {
    h.render().containerRef({ clientWidth: 10000 })
    const state = h.render()
    assert.equal(state.pageSize, 60)
    assert.deepEqual(state.pageSizeOptions, [30, 60, 90])
    assert.ok(state.pageSizeOptions.every(n => n % 30 === 0 && n <= 100))
  } finally { h.cleanup() }
})

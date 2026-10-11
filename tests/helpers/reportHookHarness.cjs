const React = require('react')
function hookHarness() {
  const slots = [], effects = [], pending = []; let cursor = 0
  const changed = (old, next) => !old || !next || old.some((value, i) => value !== next[i])
  const hooks = { ...React,
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo: (fn, deps) => { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value },
    useCallback: (fn, deps) => hooks.useMemo(() => fn, deps),
    useEffect: (fn, deps) => { const i = cursor++; if (changed(effects[i]?.deps, deps)) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() } }) },
  }
  return { hooks, render: fn => { cursor = 0; const result = fn(); pending.splice(0).forEach(fn => fn()); return result }, unmount: () => effects.forEach(e => e?.cleanup?.()) }
}
module.exports = { hookHarness }

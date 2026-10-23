import type { Navigator } from 'react-router-dom'

type Blocker = (run: () => void) => void
const guards = new WeakMap<Navigator, { blockers: Set<Blocker>; destroy: () => void }>()
let proceeding = 0
export function proceedDraftNavigation(run: () => void) {
  proceeding++
  try { run() } finally { proceeding-- }
}

// BrowserRouter has no data-router blocker; nested editors share one history guard.
export function registerDraftNavigation(navigator: Navigator, blocker: Blocker) {
  let guard = guards.get(navigator)
  if (!guard) {
    const blockers = new Set<Blocker>(), original = { push: navigator.push, replace: navigator.replace, go: navigator.go }
    let index = window.history?.state?.idx, restoring: number | null = null, allowPop = false
    const request = (run: () => void) => {
      if (proceeding || !blockers.size) run()
      else [...blockers].at(-1)!(() => proceedDraftNavigation(run))
    }
    navigator.push = (...args) => request(() => { original.push.apply(navigator, args); index = window.history?.state?.idx })
    navigator.replace = (...args) => request(() => { original.replace.apply(navigator, args); index = window.history?.state?.idx })
    navigator.go = delta => request(() => { allowPop = true; original.go.call(navigator, delta) })
    const pop = (event: PopStateEvent) => {
      const target = window.history.state?.idx
      if (allowPop) { allowPop = false; index = target; return }
      if (typeof index !== 'number' || typeof target !== 'number') return
      event.stopImmediatePropagation()
      if (restoring !== null) {
        const delta = restoring; restoring = null
        request(() => { allowPop = true; original.go.call(navigator, delta) })
      } else if (target !== index) {
        restoring = target - index
        window.history.go(-restoring)
      }
    }
    window.addEventListener('popstate', pop, true)
    guard = { blockers, destroy: () => { Object.assign(navigator, original); window.removeEventListener('popstate', pop, true); guards.delete(navigator) } }
    guards.set(navigator, guard)
  }
  guard.blockers.add(blocker)
  return () => { guard.blockers.delete(blocker); if (!guard.blockers.size) guard.destroy() }
}

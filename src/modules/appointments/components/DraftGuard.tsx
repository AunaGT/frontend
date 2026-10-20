import { useContext, useEffect, useRef, useState } from 'react'
import { UNSAFE_NavigationContext, type Navigator } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

type Blocker = (run: () => void) => void
const guards = new WeakMap<Navigator, { blockers: Set<Blocker>; destroy: () => void }>()
let proceeding = 0
function proceed(run: () => void) {
  proceeding++
  try { run() } finally { proceeding-- }
}

// BrowserRouter has no data-router blocker; share one guard so nested editors prompt once.
export function registerDraftNavigation(navigator: Navigator, blocker: Blocker) {
  let guard = guards.get(navigator)
  if (!guard) {
    const blockers = new Set<Blocker>(), original = { push: navigator.push, replace: navigator.replace, go: navigator.go }
    let index = window.history?.state?.idx, restoring: number | null = null, allowPop = false
    const request = (run: () => void) => {
      if (proceeding || !blockers.size) run()
      else [...blockers].at(-1)!(() => proceed(run))
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

export function useDraftGuard(dirty: boolean, registerTenantExitGuard?: (guard: () => boolean) => () => void, tenantKey?: string) {
  const context = useContext(UNSAFE_NavigationContext), [action, setAction] = useState<(() => void) | null>(null)
  const latestDirty=useRef(dirty),allowUnload=useRef(false)
  latestDirty.current=dirty
  useEffect(()=>{
    allowUnload.current=false
    return registerTenantExitGuard?.(()=>{
      if(latestDirty.current&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos y cambiar de empresa o sucursal?'))return false
      allowUnload.current=true
      return true
    })
  },[registerTenantExitGuard,tenantKey])
  useEffect(()=>{allowUnload.current=false},[dirty])
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { if(!allowUnload.current){event.preventDefault(); event.returnValue = ''} }
    const cleanup = context?.navigator ? registerDraftNavigation(context.navigator, run => setAction(() => run)) : undefined
    window.addEventListener('beforeunload', unload)
    return () => { cleanup?.(); window.removeEventListener('beforeunload', unload) }
  }, [dirty, context?.navigator])
  return { request: (run: () => void) => { if (dirty) setAction(() => run); else proceed(run) }, proceed,
    dialog: <ConfirmDialog open={!!action} onOpenChange={open => { if (!open) setAction(null) }} appearance="auna" title="¿Descartar los cambios?" description="Los cambios sin guardar se perderán. Puedes continuar editando." confirmText="Descartar cambios" cancelText="Seguir editando" onConfirm={() => { if (action) proceed(action); setAction(null) }} /> }
}

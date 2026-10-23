import { useContext, useEffect, useRef, useState } from 'react'
import { UNSAFE_NavigationContext } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { registerDraftNavigation, proceedDraftNavigation as proceed } from '@/lib/draftNavigation'
export { registerDraftNavigation } from '@/lib/draftNavigation'

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

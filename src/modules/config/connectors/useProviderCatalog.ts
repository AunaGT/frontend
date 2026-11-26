import { useEffect, useRef, useState } from 'react'
import { readProviderCatalog, selectProvider } from './api'
import type { ConnectorScope, ProviderCatalog } from './types'

type Owner = { key: string; controller: AbortController; active: boolean; busy: boolean }
type Model = { owner: Owner; data: ProviderCatalog | null; loading: boolean; pending: boolean; error: string }
const fresh = (owner: Owner): Model => ({ owner, data: null, loading: true, pending: false, error: '' })
const errors: Record<string, string> = {
  FISCAL_PROVIDER_STALE: 'La selección cambió en otra sesión. Recarga para ver el conector actual.',
  FISCAL_PROVIDER_ALREADY_SELECTED: 'Desactiva el conector actual antes de activar otro.',
  FISCAL_FORBIDDEN: 'No tienes permiso para cambiar el conector.',
  FISCAL_STORAGE_NOT_READY: 'El administrador debe preparar el almacenamiento fiscal.',
  FISCAL_PROVIDER_INVALID: 'La selección guardada necesita revisión del administrador.',
}
export function useProviderCatalog(scope: ConnectorScope) {
  const key = JSON.stringify(scope), live = useRef<Owner | null>(null)
  if (live.current?.key !== key) {
    if (live.current) { live.current.active = false; live.current.controller.abort() }
    live.current = { key, controller: new AbortController(), active: true, busy: false }
  }
  const owner = live.current
  const [model, setModel] = useState(() => fresh(owner)), state = model.owner === owner ? model : fresh(owner)
  const latest = useRef(state); latest.current = state
  const current = (signal: AbortSignal) => owner.active && live.current === owner && !signal.aborted
  const patch = (signal: AbortSignal, change: Partial<Model>) => { if (current(signal)) setModel(old => ({ ...(old.owner === owner ? old : fresh(owner)), ...change })) }
  const showError = (signal: AbortSignal, error: unknown) => {
    if ((error as Error)?.name !== 'AbortError') patch(signal, { error: errors[(error as { data?: { code?: string } })?.data?.code || ''] || 'No se pudo guardar o cargar la selección. Recarga para comprobar su estado.' })
  }
  const reload = async () => {
    const signal = owner.controller.signal
    if (!current(signal) || owner.busy) return
    owner.busy = true; patch(signal, { loading: true, error: '' })
    try { patch(signal, { data: await readProviderCatalog(scope, signal) }) }
    catch (e) { showError(signal, e) }
    finally { if (current(signal)) { owner.busy = false; patch(signal, { loading: false }) } }
  }
  useEffect(() => {
    owner.controller = new AbortController(); owner.active = true; owner.busy = false
    void reload()
    return () => { owner.active = false; owner.controller.abort() }
  }, [owner])
  const choose = async (provider: 'INFILE' | null) => {
    const signal = owner.controller.signal, value = latest.current
    if (!current(signal) || owner.busy || value.loading || !value.data || scope.branchId === 'all') return false
    owner.busy = true; patch(signal, { pending: true, error: '' })
    try {
      const data = await selectProvider(scope, { provider, expectedRevision: value.data.revision }, signal)
      if (!current(signal)) return false
      patch(signal, { data }); return true
    } catch (e) { showError(signal, e); return false }
    finally { if (current(signal)) { owner.busy = false; patch(signal, { pending: false }) } }
  }
  return { ...state, reload, choose }
}

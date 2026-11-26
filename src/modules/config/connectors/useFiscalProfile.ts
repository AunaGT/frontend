import { useEffect, useRef, useState } from 'react'
import { readFiscalProfile, readConnection, saveFiscalProfile } from './api'
import type { ConnectorScope, Environment, ProfileDraft, FiscalProfile } from './types'
export const emptyProfile = (): ProfileDraft => ({ documentType: '', taxRules: [], unitMap: [], productTaxMap: [], categoryTaxMap: [], establishments: [] })
const draftOf = (profile: FiscalProfile['profile']): ProfileDraft => profile ? structuredClone({ documentType: profile.documentType, taxRules: profile.taxRules, unitMap: profile.unitMap, productTaxMap: profile.productTaxMap, categoryTaxMap: profile.categoryTaxMap, establishments: profile.establishments }) : emptyProfile()
type Owner = { key: string; active: boolean; controller: AbortController }
type Model = { owner: Owner; data: FiscalProfile | null; draft: ProfileDraft; baseline: string; loading: boolean; pending: boolean; error: string; fieldErrors: Record<string, string>; encryptionReady: boolean }
const fresh = (owner: Owner): Model => ({ owner, data: null, draft: emptyProfile(), baseline: JSON.stringify(emptyProfile()), loading: true, pending: false, error: '', fieldErrors: {}, encryptionReady: false })
export function useFiscalProfile(scope: ConnectorScope, environment: Environment) {
  const key = JSON.stringify([scope, environment]), live = useRef<Owner | null>(null)
  if (live.current?.key !== key) { if (live.current) { live.current.active = false; live.current.controller.abort() } live.current = { key, active: true, controller: new AbortController() } }
  const owner = live.current, [stored, setStored] = useState(() => fresh(owner)), state = stored.owner === owner ? stored : fresh(owner)
  const latest = useRef(state); latest.current = state
  const busy = useRef(false), attempt = useRef<{ signature: string; key: string } | null>(null), activity = useRef({ dirty: false, pending: false })
  const dirty = JSON.stringify(state.draft) !== state.baseline
  activity.current = { dirty, pending: state.pending || busy.current }
  const current = () => owner.active && live.current === owner
  const patch = (values: Partial<Model>) => { if (current()) { latest.current = { ...latest.current, ...values }; setStored(latest.current) } }
  const showError = (e: unknown) => {
    if (!current() || (e as Error)?.name === 'AbortError') return
    const data = (e as { data?: { code?: string; fields?: Record<string, string> } })?.data
    const messages: Record<string, string> = { FISCAL_ISSUER_CHANGED: 'Los datos fiscales o las tasas de Contabilidad cambiaron. Recarga y revísalos antes de guardar.', FISCAL_STALE_VERSION: 'La conexión o el perfil cambió en otra sesión. Recarga antes de guardar.', FISCAL_KEYRING_UNAVAILABLE: 'El administrador debe preparar el cifrado del servidor.', FISCAL_STORAGE_NOT_READY: 'Falta aplicar la actualización de almacenamiento fiscal.', FISCAL_PROFILE_REFERENCE_INVALID: 'Hay destinos que ya no están disponibles en esta empresa.', FISCAL_PROFILE_INVALID: 'Revisa los datos señalados del perfil.', FISCAL_PROFILE_TOO_LARGE: 'El perfil supera el tamaño admitido. Reduce la cantidad de relaciones.', FISCAL_FORBIDDEN: 'No tienes permiso para guardar este perfil.' }
    patch({ error: messages[data?.code || ''] || 'No se pudo completar la operación. Vuelve a intentarlo.', fieldErrors: data?.fields || {} })
  }
  const reload = async () => {
    if (!current() || busy.current) return
    patch({ loading: true, error: '' })
    try {
      const [data, connection] = await Promise.all([readFiscalProfile(scope, environment, owner.controller.signal), readConnection(scope, environment, owner.controller.signal)])
      if (!current()) return
      const draft = draftOf(data.profile); attempt.current = null; activity.current.dirty = false
      patch({ data, draft, baseline: JSON.stringify(draft), encryptionReady: connection.capabilities.encryptionReady, fieldErrors: {} })
    } catch (e) { showError(e) } finally { patch({ loading: false }) }
  }
  useEffect(() => { owner.active = true; owner.controller = new AbortController(); busy.current = false; attempt.current = null; void reload(); return () => { owner.active = false; owner.controller.abort() } }, [owner])
  const update = (change: (draft: ProfileDraft) => ProfileDraft) => {
    if (!current() || busy.current) return
    const draft = change(structuredClone(latest.current.draft)); activity.current.dirty = JSON.stringify(draft) !== latest.current.baseline
    patch({ draft, error: '', fieldErrors: {} })
  }
  const save = async () => {
    const model = latest.current
    if (!current() || busy.current || model.loading || !model.data || !model.encryptionReady || scope.branchId === 'all' || JSON.stringify(model.draft) === model.baseline && !model.data.readiness.fieldErrors['emitter.changed']) return false
    const signature = JSON.stringify([owner.key, model.data.revision, model.draft])
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() }
    busy.current = true; activity.current.pending = true; patch({ pending: true, error: '', fieldErrors: {} })
    try {
      const saved = await saveFiscalProfile(scope, environment, { expectedVersion: model.data.revision, expectedIssuerFingerprint: model.data.currentIssuer.settingsFingerprint, idempotencyKey: attempt.current.key, profile: model.draft }, owner.controller.signal)
      if (!current()) return false
      activity.current.dirty = false; attempt.current = null
      patch({ baseline: JSON.stringify(model.draft), data: { ...model.data, revision: saved.revision } })
      try { const data = await readFiscalProfile(scope, environment, owner.controller.signal); if (current()) { const draft = draftOf(data.profile); patch({ data, draft, baseline: JSON.stringify(draft) }) } }
      catch (e) { if (current() && (e as Error)?.name !== 'AbortError') patch({ error: 'El perfil se guardó, pero no se pudo actualizar la vista. Recarga; no necesitas guardarlo otra vez.' }) }
      return current()
    } catch (e) { showError(e); return false }
    finally { if (current()) { busy.current = false; activity.current.pending = false; patch({ pending: false }) } }
  }
  return { ...state, dirty, activity, update, save, reload }
}

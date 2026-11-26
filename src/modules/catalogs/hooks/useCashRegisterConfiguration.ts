import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCashRegisterConfiguration, saveCashRegisterConfiguration, type RegisterConfiguration, type RegisterConfigurationInput, type RegisterConfigurationScope } from '@/services/cashSessionsService'

type Pending = { input: RegisterConfigurationInput }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function registerConfigurationScopeKey(scope: RegisterConfigurationScope, id?: string) { return JSON.stringify([scope.companyId, scope.branchId, scope.actorId, id || 'new']) }
export function createRegisterConfigurationAttempt(scope: RegisterConfigurationScope & { id?: string }, storage: Storage) {
  const key = 'auna:cash-configuration:attempt:' + registerConfigurationScopeKey(scope, scope.id)
  let running: Promise<RegisterConfiguration> | null = null
  const pending = (): Pending | null => {
    const value = storage.getItem(key)
    if (!value) return null
    const parsed = JSON.parse(value) as Pending
    if (!parsed?.input?.requestKey || !parsed.input.name) throw Error('El intento guardado no se pudo leer. No se enviará otro guardado.')
    return parsed
  }
  return { pending, save(input: Omit<RegisterConfigurationInput, 'requestKey'>, send: (input: RegisterConfigurationInput) => Promise<RegisterConfiguration>) {
    if (running) return running
    const prior = pending(), command = prior?.input || { ...input, requestKey: crypto.randomUUID() }
    storage.setItem(key, JSON.stringify({ input: command }))
    running = (async () => {
      try {
        const result = await send(command)
        if (!result?.id || !Number.isSafeInteger(result.revision) || result.revision < 1 || !result.command_id || typeof result.replayed !== 'boolean' || typeof result.name !== 'string' || typeof result.code !== 'string' || typeof result.active !== 'boolean' || typeof result.is_default !== 'boolean' || !Array.isArray(result.authorized_users) || !Array.isArray(result.legacy_suggested_users) || [...result.authorized_users, ...result.legacy_suggested_users].some(person => !person || typeof person.id !== 'string' || typeof person.name !== 'string')) throw Error('No se pudo confirmar el guardado. Recupera el resultado antes de volver a editar.')
        storage.removeItem(key)
        return result
      } catch (error) {
        const status = (error as { status?: number }).status
        // A denial on recovery does not prove that the original transaction failed.
        if (!prior && status && [400,403,404,409,428].includes(status)) storage.removeItem(key)
        throw error
      } finally { running = null }
    })()
    return running
  } }
}
export type RegisterDraft = { name: string; code: string; currencyCode: string; active: boolean; isDefault: boolean; authorizedUserIds: string[]; enableExplicitAccess: boolean; operationMode?: 'INDIVIDUAL' | 'SHARED' }
const blank = (): RegisterDraft => ({ name: '', code: '', currencyCode: '', active: true, isDefault: false, authorizedUserIds: [], enableExplicitAccess: false })
function fromRecord(record: RegisterConfiguration): RegisterDraft { return { name: record.name, code: record.code, currencyCode: record.currency_code || '', active: record.active, isDefault: record.is_default, authorizedUserIds: record.authorized_users.filter(u => u.active).map(u => u.id), enableExplicitAccess: false, operationMode: record.operation_mode || 'INDIVIDUAL' } }
export function useCashRegisterConfiguration({ companyId, branchId, actorId, id, readOnly = false }: RegisterConfigurationScope & { id?: string; readOnly?: boolean }) {
  const scope = { companyId, branchId, actorId }, storageIdentity = registerConfigurationScopeKey(scope, id), identity = storageIdentity + (readOnly ? ':view' : ':edit')
  const live = useRef(identity); live.current = identity
  const [draft, setDraft] = useState<RegisterDraft>(blank), [record, setRecord] = useState<RegisterConfiguration | null>(null)
  const [loading, setLoading] = useState(!!id), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [conflict, setConflict] = useState(false), [uncertain, setUncertain] = useState(false)
  const [stateIdentity, setStateIdentity] = useState(identity)
  const [recoveryBlocked, setRecoveryBlocked] = useState(false)
  const attempt = useRef<ReturnType<typeof createRegisterConfigurationAttempt> | null>(null), snapshot = useRef('')
  const draftKey = 'auna:cash-configuration:draft:' + storageIdentity
  const loadCurrent = useCallback(async (keepDraft = true) => {
    if (!id || recoveryBlocked) return
    setLoading(true)
    try {
      const current = await fetchCashRegisterConfiguration(id, scope)
      if (live.current !== identity) return
      setRecord(current); setConflict(false); setError(null)
      if (!keepDraft || readOnly) { const next = fromRecord(current); snapshot.current = JSON.stringify(next); setDraft(next) }
    } catch (e) { if (live.current === identity) setError(e instanceof Error ? e.message : 'No se pudo cargar la caja') }
    finally { if (live.current === identity) setLoading(false) }
    // Identity is the complete immutable request scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, recoveryBlocked])
  useEffect(() => {
    let cancelled = false
    setStateIdentity(identity)
    setRecord(null); setDraft(blank()); setError(null); setConflict(false); setBusy(false); setUncertain(false); setRecoveryBlocked(false); setLoading(!!id)
    try {
      attempt.current = readOnly ? null : createRegisterConfigurationAttempt({ ...scope, id }, sessionStorage)
      const pending = attempt.current?.pending(), saved = readOnly ? null : JSON.parse(sessionStorage.getItem(draftKey) || 'null')
      const restored = pending ? { ...blank(), ...pending.input, code: pending.input.code || '', isDefault: pending.input.isDefault ?? false, authorizedUserIds: pending.input.authorizedUserIds || [], enableExplicitAccess: pending.input.enableExplicitAccess === true } : saved?.draft
      setUncertain(!!pending)
      if (restored) setDraft(restored)
      if (!id) { snapshot.current = JSON.stringify(blank()); return }
      void fetchCashRegisterConfiguration(id, scope).then(current => {
        if (cancelled || live.current !== identity) return
        setRecord(current)
        const next = fromRecord(current); snapshot.current = JSON.stringify(next)
        // Persist the original revision, not the fresh one, with an unsaved edit.
        if (saved?.revision && restored && !pending) setRecord({ ...current, revision: saved.revision })
        if (!restored) setDraft(next)
      }).catch(e => { if (!cancelled && live.current === identity) setError(e.message) }).finally(() => { if (!cancelled && live.current === identity) setLoading(false) })
    } catch { setError('No se pudo leer el borrador o intento anterior. El guardado está bloqueado para evitar duplicados. Puedes consultar la configuración guardada sin borrar el intento.'); setRecoveryBlocked(true); setLoading(false); attempt.current = null }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity])
  useEffect(() => {
    if (readOnly || recoveryBlocked || !snapshot.current || loading || stateIdentity !== identity) return
    try {
      if (JSON.stringify(draft) !== snapshot.current) sessionStorage.setItem(draftKey, JSON.stringify({ draft, revision: record?.revision }))
      else sessionStorage.removeItem(draftKey)
    } catch { /* The command itself must persist before sending. */ }
  }, [draftKey, draft, record?.revision, loading, stateIdentity, identity, readOnly, recoveryBlocked])
  useEffect(() => () => { live.current = '' }, [])
  const inFlight = useRef(false)
  async function save() {
    if (readOnly || recoveryBlocked || live.current !== identity || inFlight.current || !attempt.current || !companyId || !branchId || !actorId || (id && !record && !uncertain)) return null
    inFlight.current = true; setBusy(true); setError(null)
    const activeAttempt = attempt.current
    try {
      const result = await activeAttempt.save({ ...(id ? { id, expectedRevision: record?.revision } : { code: draft.code }), name: draft.name, ...(draft.currencyCode ? { currencyCode: draft.currencyCode } : {}), active: draft.active, isDefault: draft.isDefault, authorizedUserIds: draft.authorizedUserIds, ...(draft.operationMode && draft.operationMode !== record?.operation_mode ? { operationMode: draft.operationMode } : {}), ...(draft.enableExplicitAccess ? { enableExplicitAccess: true as const } : {}) }, input => saveCashRegisterConfiguration(input, scope))
      if (live.current !== identity) return null
      sessionStorage.removeItem(draftKey); setUncertain(false); setConflict(false)
      setRecord(result); const next = fromRecord(result); snapshot.current = JSON.stringify(next); setDraft(next)
      return result
    } catch (e) {
      if (live.current === identity) { setError(e instanceof Error ? e.message : 'No se pudo confirmar el guardado'); setConflict((e as { code?: string }).code === 'CASH_CONFIGURATION_STALE'); setUncertain(!!activeAttempt.pending()) }
      return null
    } finally { inFlight.current = false; if (live.current === identity) setBusy(false) }
  }
  const sameScope = stateIdentity === identity
  return { draft: sameScope ? draft : blank(), setDraft, record: sameScope ? record : null, loading: !sameScope || loading, busy: sameScope && busy, uncertain: sameScope && uncertain, recoveryBlocked: sameScope && recoveryBlocked, error: sameScope ? error : null, setError, conflict: sameScope && conflict, save, loadCurrent, dirty: !readOnly && sameScope && JSON.stringify(draft) !== snapshot.current }
}

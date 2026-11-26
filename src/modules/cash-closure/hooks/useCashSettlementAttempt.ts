import { useEffect, useRef, useState } from 'react'
import type { Settlement, SettlementScope } from '@/services/cashSettlementsService'
import { createPersistedAttempt } from './useCashMovementAttempt'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
type Receipt = { replayed: boolean; settlement: Settlement }
export const settlementIdentity = (scope: SettlementScope) => JSON.stringify([scope.companyId, scope.branchId, scope.actorId, 'settlement', 'new'])
export function createSettlementAttempt(identity: string, storage: Storage) {
  return createPersistedAttempt<{ requestKey: string } & Record<string, unknown>, Receipt>('auna:cash-settlement:attempt:' + identity, storage,
    { readable: input => Array.isArray(input.allocations), valid: r => !!r?.settlement?.id && typeof r.replayed === 'boolean' && typeof r.settlement.net === 'string' })
}
// Mismo contrato que los demás registros de efectivo: clave guardada antes de enviar y solo un recibo completo la libera.
export function useSettlementAttempt<Draft extends object>(scope: SettlementScope, blank: Draft) {
  const identity = settlementIdentity(scope), draftKey = 'auna:cash-settlement:draft:' + identity
  const [initial] = useState(() => {
    try {
      const attempt = createSettlementAttempt(identity, sessionStorage)
      return { attempt, pending: !!attempt.pending(), draft: { ...blank, ...JSON.parse(sessionStorage.getItem(draftKey) || 'null') } as Draft, blocked: false }
    } catch { return { attempt: null, pending: false, draft: blank, blocked: true } }
  })
  const [draft, setDraft] = useState<Draft>(initial.draft), [pending, setPending] = useState(initial.pending), [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initial.blocked ? 'No se pudo leer el intento anterior. El registro está bloqueado para evitar duplicados; revisa las liquidaciones.' : null)
  const alive = useRef(true), inFlight = useRef(false)
  useEffect(() => () => { alive.current = false }, [])
  useEffect(() => { if (!initial.blocked && !pending) try { sessionStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* el intento se guarda aparte */ } }, [draft, draftKey, pending, initial.blocked])
  async function submit(input: Record<string, unknown>, send: (command: { requestKey: string } & Record<string, unknown>) => Promise<Receipt>) {
    if (inFlight.current || !initial.attempt) return null
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const receipt = await initial.attempt.save(input, send)
      if (!alive.current) return null
      try { sessionStorage.removeItem(draftKey) } catch { /* sin almacenamiento */ }
      setPending(false); return receipt
    } catch (e) {
      if (alive.current) { setError(e instanceof Error ? e.message : 'No se pudo registrar la liquidación'); try { setPending(!!initial.attempt.pending()) } catch { setPending(true) } }
      return null
    } finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  return { draft, setDraft, pending, busy, error, recoveryBlocked: initial.blocked, submit }
}

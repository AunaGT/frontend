import { useEffect, useRef, useState } from 'react'
import type { CustodyScope, HandoverReceipt, TransferReceipt } from '@/services/cashCustodyService'
import { createPersistedAttempt } from './useCashMovementAttempt'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
type Receipt = TransferReceipt | HandoverReceipt
export type CustodyAction = 'send' | 'handover'
export function custodyIdentity(scope: CustodyScope, action: CustodyAction, target?: string) {
  return JSON.stringify([scope.companyId, scope.branchId, scope.actorId, 'custody', action, target || 'new'])
}
const valid = (r: Receipt | null | undefined) => !!r && typeof r.replayed === 'boolean' && ('transfer' in r
  ? !!r.transfer?.id && typeof r.transfer.amount === 'string' : 'handover' in r && !!r.handover?.id && typeof r.handover.delivered_amount === 'string')
export function createCustodyAttempt(identity: string, storage: Storage) {
  return createPersistedAttempt<{ requestKey: string } & Record<string, unknown>, Receipt>('auna:cash-custody:attempt:' + identity, storage, { readable: input => typeof input === 'object', valid })
}

// La página se remonta al cambiar empresa, sucursal, persona u objetivo: el borrador nunca cruza alcances.
export function useCustodyAttempt<Draft extends object>({ scope, action, target, blank }: { scope: CustodyScope; action: CustodyAction; target?: string; blank: Draft }) {
  const identity = custodyIdentity(scope, action, target), draftKey = 'auna:cash-custody:draft:' + identity
  const [initial] = useState(() => {
    try {
      const attempt = createCustodyAttempt(identity, sessionStorage)
      return { attempt, pending: !!attempt.pending(), draft: { ...blank, ...JSON.parse(sessionStorage.getItem(draftKey) || 'null') } as Draft, blocked: false }
    } catch { return { attempt: null, pending: false, draft: blank, blocked: true } }
  })
  const [draft, setDraft] = useState<Draft>(initial.draft), [pending, setPending] = useState(initial.pending), [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initial.blocked ? 'No se pudo leer el intento o borrador anterior. El registro está bloqueado para evitar duplicados; revisa los traslados.' : null)
  const alive = useRef(true), inFlight = useRef(false)
  useEffect(() => () => { alive.current = false }, [])
  useEffect(() => {
    if (initial.blocked || pending) return
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* el comando se persiste aparte */ }
  }, [draft, draftKey, pending, initial.blocked])
  async function submit<R extends Receipt>(input: Record<string, unknown>, send: (command: { requestKey: string } & Record<string, unknown>) => Promise<R>) {
    if (inFlight.current || !initial.attempt) return null
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const receipt = await initial.attempt.save(input, send) as R
      if (!alive.current) return null
      try { sessionStorage.removeItem(draftKey) } catch { /* sin almacenamiento */ }
      setPending(false)
      return receipt
    } catch (e) {
      if (alive.current) { setError(e instanceof Error ? e.message : 'No se pudo registrar'); try { setPending(!!initial.attempt.pending()) } catch { setPending(true) } }
      return null
    } finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  return { draft, setDraft, pending, busy, error, recoveryBlocked: initial.blocked, submit }
}

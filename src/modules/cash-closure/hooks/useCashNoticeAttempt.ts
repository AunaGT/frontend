import { useEffect, useRef, useState } from 'react'
import type { NoticeReceipt, NoticeScope } from '@/services/cashNoticesService'
import { createPersistedAttempt } from './useCashMovementAttempt'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export const noticeIdentity = (scope: NoticeScope) => JSON.stringify([scope.companyId, scope.branchId, scope.actorId, 'notice', 'new'])
export function createNoticeAttempt(identity: string, storage: Storage) {
  return createPersistedAttempt<{ requestKey: string } & Record<string, unknown>, NoticeReceipt>('auna:cash-notice:attempt:' + identity, storage,
    { readable: input => typeof input.customerId === 'string', valid: r => !!r?.notice?.id && typeof r.replayed === 'boolean' && typeof r.notice.amount === 'string' })
}

// Mismo contrato que movimientos y traslados: clave guardada antes de enviar, un envío en vuelo y solo un recibo completo la libera.
export function useNoticeAttempt<Draft extends object>(scope: NoticeScope, blank: Draft) {
  const identity = noticeIdentity(scope), draftKey = 'auna:cash-notice:draft:' + identity
  const [initial] = useState(() => {
    try {
      const attempt = createNoticeAttempt(identity, sessionStorage)
      return { attempt, pending: !!attempt.pending(), draft: { ...blank, ...JSON.parse(sessionStorage.getItem(draftKey) || 'null') } as Draft, blocked: false }
    } catch { return { attempt: null, pending: false, draft: blank, blocked: true } }
  })
  const [draft, setDraft] = useState<Draft>(initial.draft), [pending, setPending] = useState(initial.pending), [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initial.blocked ? 'No se pudo leer el intento anterior. El registro está bloqueado para evitar duplicados; revisa la lista de avisos.' : null)
  const alive = useRef(true), inFlight = useRef(false)
  useEffect(() => () => { alive.current = false }, [])
  useEffect(() => { if (!initial.blocked && !pending) try { sessionStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* el intento se guarda aparte */ } }, [draft, draftKey, pending, initial.blocked])
  async function submit(input: Record<string, unknown>, send: (command: { requestKey: string } & Record<string, unknown>) => Promise<NoticeReceipt>) {
    if (inFlight.current || !initial.attempt) return null
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const receipt = await initial.attempt.save(input, send)
      if (!alive.current) return null
      try { sessionStorage.removeItem(draftKey) } catch { /* sin almacenamiento */ }
      setPending(false); return receipt
    } catch (e) {
      if (alive.current) { setError(e instanceof Error ? e.message : 'No se pudo registrar el aviso'); try { setPending(!!initial.attempt.pending()) } catch { setPending(true) } }
      return null
    } finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  return { draft, setDraft, pending, busy, error, recoveryBlocked: initial.blocked, submit }
}

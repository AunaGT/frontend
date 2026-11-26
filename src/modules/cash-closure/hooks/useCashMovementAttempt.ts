import { useEffect, useRef, useState } from 'react'
import type { CashMovementDirection, CashMovementReceipt, CashMovementScope, CorrectCashMovementCommand, CreateCashMovementCommand } from '@/services/cashMovementsService'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
type Command = CreateCashMovementCommand | CorrectCashMovementCommand
type CommandInput = Omit<CreateCashMovementCommand, 'requestKey'> | Omit<CorrectCashMovementCommand, 'requestKey'>
export type CashMovementAction = 'create' | 'correct'
export type CashMovementDraft = { direction: '' | CashMovementDirection; sessionId: string; amount: string; methodId: string; counterparty: string; reason: string; reference: string; confirmed: boolean }
export const blankCashMovementDraft = (): CashMovementDraft => ({ direction: '', sessionId: '', amount: '', methodId: '', counterparty: '', reason: '', reference: '', confirmed: false })

const ATTEMPT = 'auna:cash-movement:attempt:', DRAFT = 'auna:cash-movement:draft:'
// El turno viaja en el comando: así un intento pendiente no se oculta al cambiar de turno en el formulario.
export function cashMovementIdentity(scope: CashMovementScope, action: CashMovementAction, originalId?: string) {
  return JSON.stringify([scope.companyId, scope.branchId, scope.actorId, action, originalId || 'new'])
}
const validReceipt = (r: CashMovementReceipt | null | undefined, command: Command) => !!r && typeof r.id === 'string' && r.requestKey === command.requestKey
  && /^[a-f\d]{64}$/.test(r.requestHash) && typeof r.replayed === 'boolean' && r.movement?.id === r.id && typeof r.movement.amount === 'string' && ['IN', 'OUT'].includes(r.movement.direction)

// Intento persistido antes de enviar: un solo envío en vuelo y solo un recibo completo lo libera.
// Lo comparten los movimientos físicos (3B.1) y la custodia (3B.2).
export function createPersistedAttempt<C extends { requestKey: string }, R>(key: string, storage: Storage, { readable, valid }: { readable: (input: C) => boolean; valid: (receipt: R, command: C) => boolean }) {
  let running: Promise<R> | null = null
  const pending = (): { input: C } | null => {
    const raw = storage.getItem(key)
    if (!raw) return null
    let parsed: { input?: C } | null = null
    try { parsed = JSON.parse(raw) } catch { /* se informa abajo */ }
    if (!parsed?.input?.requestKey || !readable(parsed.input)) throw Error('El intento guardado no se pudo leer. No se enviará otro registro; consulta la lista antes de reintentar.')
    return parsed as { input: C }
  }
  return { pending, save(input: Omit<C, 'requestKey'>, send: (command: C) => Promise<R>): Promise<R> {
    if (running) return running
    let prior: { input: C } | null
    try { prior = pending() } catch (error) { return Promise.reject(error) }
    const command = prior?.input || { ...input, requestKey: crypto.randomUUID() } as C
    storage.setItem(key, JSON.stringify({ input: command }))
    running = (async () => {
      try {
        const result = await send(command)
        if (!valid(result, command)) throw Error('No se pudo confirmar el registro. Recupera el resultado antes de intentar otro.')
        storage.removeItem(key)
        return result
      } catch (error) {
        const status = (error as { status?: number }).status
        // Un rechazo al recuperar no prueba que el envío original falló: solo el primer intento se libera.
        if (!prior && status && [400, 403, 404, 409].includes(status)) storage.removeItem(key)
        throw error
      } finally { running = null }
    })()
    return running
  } }
}
export function createCashMovementAttempt(identity: string, storage: Storage) {
  return createPersistedAttempt<Command, CashMovementReceipt>(ATTEMPT + identity, storage, {
    readable: input => !!input.cashRegisterSessionId && typeof input.reason === 'string', valid: validReceipt })
}

function fromCommand(command: Command): CashMovementDraft {
  const base = { ...blankCashMovementDraft(), sessionId: command.cashRegisterSessionId, reason: command.reason, reference: command.reference || '' }
  return 'direction' in command ? { ...base, direction: command.direction, amount: command.amount, methodId: String(command.paymentMethodId), counterparty: command.counterpartyLabel } : { ...base, confirmed: true }
}
function restore(identity: string) {
  try {
    const attempt = createCashMovementAttempt(identity, sessionStorage), prior = attempt.pending()
    const saved = JSON.parse(sessionStorage.getItem(DRAFT + identity) || 'null') as Partial<CashMovementDraft> | null
    return { attempt, draft: prior ? fromCommand(prior.input) : { ...blankCashMovementDraft(), ...saved }, pending: !!prior, blocked: false }
  } catch { return { attempt: null, draft: blankCashMovementDraft(), pending: false, blocked: true } }
}

// La página se remonta al cambiar empresa, sucursal, persona, acción u original: el estado nunca cruza alcances.
export function useCashMovementAttempt({ companyId, branchId, actorId, action, originalId }: CashMovementScope & { action: CashMovementAction; originalId?: string }) {
  const identity = cashMovementIdentity({ companyId, branchId, actorId }, action, originalId)
  const [initial] = useState(() => restore(identity))
  const [draft, setDraft] = useState(initial.draft), [pending, setPending] = useState(initial.pending), [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initial.blocked ? 'No se pudo leer el intento o borrador anterior. El registro está bloqueado para evitar duplicados; revisa la lista de movimientos.' : null)
  const alive = useRef(true), inFlight = useRef(false)
  useEffect(() => () => { alive.current = false }, [])
  useEffect(() => {
    if (initial.blocked || pending) return
    try {
      if (JSON.stringify(draft) === JSON.stringify(blankCashMovementDraft())) sessionStorage.removeItem(DRAFT + identity)
      else sessionStorage.setItem(DRAFT + identity, JSON.stringify(draft))
    } catch { /* el comando se persiste aparte antes de enviarse */ }
  }, [draft, identity, pending, initial.blocked])
  async function submit(input: CommandInput, send: (command: Command) => Promise<CashMovementReceipt>) {
    if (inFlight.current || !initial.attempt) return null
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const receipt = await initial.attempt.save(input, send)
      if (!alive.current) return null
      try { sessionStorage.removeItem(DRAFT + identity) } catch { /* sin almacenamiento */ }
      setPending(false)
      return receipt
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : 'No se pudo registrar el movimiento')
        try { setPending(!!initial.attempt.pending()) } catch { setPending(true) }
      }
      return null
    } finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  return { draft, setDraft, pending, busy, error, recoveryBlocked: initial.blocked, submit }
}

/**
 * Estado del turno de caja para «mi cierre»: solo arquear si hay turno cerrado sin cierre.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchCashSessionCurrent,
  sessionOpenedAtToLocalInput,
  type CashRegisterDto,
  type CashRegisterSessionDto,
} from '@/services/cashSessionsService'

export const CASH_SESSION_CURRENT_QUERY_KEY = ['cash-session', 'current'] as const

export type MineClosureReason =
  | 'ok'
  | 'loading'
  | 'register-open-own'
  | 'register-open-other'
  | 'no-pending'
  | 'error'

export interface MineClosureGateState {
  loading: boolean
  canCalculate: boolean
  reason: MineClosureReason
  errorMessage: string | null
  closableSessionId: string | null
  register: CashRegisterDto | null
  openSession: CashRegisterSessionDto | null
  closableSession: CashRegisterSessionDto | null
}

const IDLE_WHEN_DISABLED: MineClosureGateState = {
  loading: false,
  canCalculate: true,
  reason: 'ok',
  errorMessage: null,
  closableSessionId: null,
  register: null,
  openSession: null,
  closableSession: null,
}

function endOfTodayLocalDateTime(timeZone: string): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T23:59:59`
}

function parseGateFromSession(
  userId: string,
  timezone: string,
  register: CashRegisterDto | null,
  session: CashRegisterSessionDto | null,
  closableRaw: CashRegisterSessionDto | null
): { gate: MineClosureGateState; sessionDates?: { startDate: string; endDate: string } } {
  const open = session?.status === 'OPEN' ? session : null
  const closable =
    closableRaw &&
    closableRaw.status === 'CLOSED' &&
    (closableRaw.cash_closure_id == null || closableRaw.cash_closure_id === '')
      ? closableRaw
      : null

  if (open) {
    const own = String(open.opened_by_id) === String(userId)
    return {
      gate: {
        loading: false,
        canCalculate: false,
        reason: own ? 'register-open-own' : 'register-open-other',
        errorMessage: null,
        closableSessionId: null,
        register,
        openSession: open,
        closableSession: closable,
      },
      sessionDates: own
        ? {
            startDate: sessionOpenedAtToLocalInput(open.opened_at, timezone),
            endDate: endOfTodayLocalDateTime(timezone),
          }
        : undefined,
    }
  }

  if (closable) {
    return {
      gate: {
        loading: false,
        canCalculate: true,
        reason: 'ok',
        errorMessage: null,
        closableSessionId: closable.id,
        register,
        openSession: null,
        closableSession: closable,
      },
      sessionDates: {
        startDate: sessionOpenedAtToLocalInput(closable.opened_at, timezone),
        endDate: closable.closed_at
          ? sessionOpenedAtToLocalInput(closable.closed_at, timezone)
          : endOfTodayLocalDateTime(timezone),
      },
    }
  }

  return {
    gate: {
      loading: false,
      canCalculate: false,
      reason: 'no-pending',
      errorMessage: null,
      closableSessionId: null,
      register,
      openSession: null,
      closableSession: null,
    },
  }
}

export function mineClosureBlockedHint(reason: MineClosureReason): string {
  switch (reason) {
    case 'register-open-own':
      return 'Cierre el turno en «Nueva venta» (fin de turno); mientras la caja siga abierta no puede arquear.'
    case 'register-open-other':
      return 'Hay turno abierto de otro cajero en esta caja.'
    case 'no-pending':
      return 'No hay turno cerrado pendiente de arqueo. Abra y cierre turno en «Nueva venta» primero.'
    default:
      return 'Actualice la página o revise su conexión.'
  }
}

export function canRegisterMineClosure(gate: MineClosureGateState): boolean {
  return !gate.loading && gate.canCalculate && !!gate.closableSessionId
}

interface UseMineClosureGateOptions {
  enabled: boolean
  userId?: string
  timezone: string
  onSessionDates?: (dates: { startDate: string; endDate: string }) => void
}

export function useMineClosureGate({
  enabled,
  userId,
  timezone,
  onSessionDates,
}: UseMineClosureGateOptions) {
  const onSessionDatesRef = useRef(onSessionDates)
  onSessionDatesRef.current = onSessionDates

  const queryEnabled = enabled && !!userId

  const { data, isLoading, isPending, error, refetch } = useQuery({
    queryKey: CASH_SESSION_CURRENT_QUERY_KEY,
    queryFn: async () => {
      const r = await fetchCashSessionCurrent()
      if (!r.ok) throw new Error(r.message || 'No se pudo verificar el turno')
      return r
    },
    enabled: queryEnabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
  })

  const parsed = useMemo(() => {
    if (!enabled || !userId || !data) return null
    return parseGateFromSession(userId, timezone, data.register, data.session, data.closableSession)
  }, [enabled, userId, data, timezone])

  const gate = useMemo((): MineClosureGateState => {
    if (!enabled) return IDLE_WHEN_DISABLED
    if (!userId) {
      return { ...IDLE_WHEN_DISABLED, loading: true, canCalculate: false, reason: 'loading' }
    }
    if (isPending || (isLoading && !data)) {
      return { ...IDLE_WHEN_DISABLED, loading: true, canCalculate: false, reason: 'loading' }
    }
    if (error) {
      return {
        loading: false,
        canCalculate: false,
        reason: 'error',
        errorMessage: error instanceof Error ? error.message : 'No se pudo verificar el turno',
        closableSessionId: null,
        register: null,
        openSession: null,
        closableSession: null,
      }
    }
    if (!parsed) {
      return { ...IDLE_WHEN_DISABLED, loading: false, canCalculate: false, reason: 'no-pending' }
    }
    return parsed.gate
  }, [enabled, userId, isPending, isLoading, data, error, parsed])

  useEffect(() => {
    if (!parsed?.sessionDates) return
    onSessionDatesRef.current?.(parsed.sessionDates)
  }, [parsed])

  const refresh = useCallback(() => {
    void refetch()
  }, [refetch])

  return { gate, refresh }
}

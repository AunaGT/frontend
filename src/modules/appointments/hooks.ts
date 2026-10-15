import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appointmentQueryKey, getAgenda, mutateAgenda, fetchAllEntries, agendaParams } from './api'
import type { AgendaScope, AgendaFilter, AvailabilityInput, Slot, Page, AgendaEntryDto, EntriesSummaryDto } from './types'

export function useAgenda(scope: AgendaScope, filter: AgendaFilter, view: 'day' | 'week' | 'month' | 'list', enabled = true) {
  const ready = enabled && !!scope.companyId && !!scope.branchId
  const bookings = useQuery({ queryKey: appointmentQueryKey(scope, 'entries-page', filter), queryFn: ({ signal }) => getAgenda<Page<AgendaEntryDto>>(`/entries?${agendaParams(filter)}`, scope, signal), enabled: ready && view === 'list' })
  const sessions = useQuery({ queryKey: appointmentQueryKey(scope, 'entries-calendar', filter), queryFn: ({ signal }) => fetchAllEntries(scope, filter, signal), enabled: ready && view !== 'list' })
  const summary = useQuery({ queryKey: appointmentQueryKey(scope, 'entries-summary', filter), queryFn: ({ signal }) => getAgenda<EntriesSummaryDto>(`/entries-summary?${agendaParams(filter)}`, scope, signal), enabled: ready })
  const main = view === 'list' ? bookings : sessions
  return { bookings: ready ? bookings.data || null : null, sessions: ready ? sessions.data || [] : [], summary: ready ? summary.data : undefined,
    isLoading: ready && main.isLoading, isError: main.isError || summary.isError, error: main.error || summary.error,
    refetch: () => { void main.refetch(); void summary.refetch() } }
}
export function useAvailability(scope: AgendaScope, input: AvailabilityInput, enabled = true, path = '/availability') {
  return useQuery({ queryKey: appointmentQueryKey(scope, 'availability', { path, ...input }), queryFn: ({ signal }) => mutateAgenda<Slot[]>(path, scope, input, signal), enabled: enabled && !!scope.companyId && scope.branchId !== 'all' && !!input.productId })
}
export function useAgendaMutation(scope: AgendaScope) {
  const qc = useQueryClient(), key = `${scope.companyId}:${scope.branchId}`, current = useRef(key)
  current.current = key
  const active = useRef<{ key: string; controller: AbortController } | null>(null)
  const [state, setState] = useState<{ key: string; pending: boolean; error: string | null; fields: Record<string, string> }>({ key, pending: false, error: null, fields: {} })
  useEffect(() => () => { active.current?.controller.abort(); active.current = null }, [key])
  const submit = async <T,>(path: string, input: object, method = 'POST'): Promise<T | null> => {
    if (active.current) return null
    const attempt = { key, controller: new AbortController() }
    active.current = attempt
    setState({ key, pending: true, error: null, fields: {} })
    try {
      const result = await mutateAgenda<T>(path, { ...scope }, input, attempt.controller.signal, method)
      if (current.current !== key || active.current !== attempt) return null
      await qc.invalidateQueries({ queryKey: ['appointments', scope.companyId] })
      if(path.startsWith('/engagements'))await Promise.all(['quote','quotes','order','orders','sales','receivables','cash-session','cash-sessions','cash-closures','accounting'].map(prefix=>qc.invalidateQueries({queryKey:[prefix]})))
      if (current.current !== key || active.current !== attempt) return null
      setState({ key, pending: false, error: null, fields: {} })
      return result
    } catch (error) {
      if (current.current === key && active.current === attempt && !attempt.controller.signal.aborted) {
        const fields = (error as { data?: { fields?: Record<string, string> } })?.data?.fields || {}
        setState({ key, pending: false, error: error instanceof Error ? error.message : 'No se pudo guardar; vuelve a intentar', fields })
      }
      return null
    } finally { if (active.current === attempt) active.current = null }
  }
  return { submit, pending: state.key === key && state.pending, error: state.key === key ? state.error : null, fields: state.key === key ? state.fields : {} }
}

import { getApiBaseUrl, getAuthToken } from '@/services/api'
import type { CashClosure } from '@/modules/cash-closure/types'

export { CASH_CLOSURE_READ_PERMISSIONS } from '@/config/cashClosurePermissions'
export type CashClosureReadScope = 'mine' | 'team'
export type CashClosureReadContext = { companyId: string; branchId: string; actorId: string }
export type CashClosureReadCapabilities = { viewOwn: boolean; viewTeam: boolean }
export type CashClosureFilters = { status?: string; startDate?: string; endDate?: string }
export type CashClosurePage = { items: CashClosure[]; summary?: Record<string, number>; page: number; pageSize: number; totalPages: number; totalItems: number }
async function request<T>(path: string, context: CashClosureReadContext, signal?: AbortSignal): Promise<T> {
  if (!context.companyId || !context.branchId || !context.actorId) throw new Error('Selecciona una empresa y sucursal')
  const res = await fetch(getApiBaseUrl() + '/cash-closures' + path, { signal, cache: 'no-store',
    headers: { Authorization: 'Bearer ' + (getAuthToken() ?? ''), 'X-Company-Id': context.companyId, 'X-Branch-Id': context.branchId } })
  const data = await res.json()
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError')
  if (!res.ok) throw Object.assign(new Error(data?.message || 'No se pudieron consultar los arqueos'), { status: res.status })
  return data as T
}
export const fetchCashClosureReadCapabilities = (context: CashClosureReadContext, signal?: AbortSignal) => request<CashClosureReadCapabilities>('/read-capabilities', context, signal)
export function fetchCashClosurePage(context: CashClosureReadContext, input: CashClosureFilters & { scope: CashClosureReadScope; page: number; pageSize: number }, signal?: AbortSignal) {
  const params = new URLSearchParams({ scope: input.scope, page: String(input.page), pageSize: String(input.pageSize), includeSummary: 'true' })
  for (const key of ['status', 'startDate', 'endDate'] as const) if (input[key]) params.set(key, input[key])
  return request<CashClosurePage>('?' + params, context, signal)
}
export const fetchCashClosureDetail = (id: string, context: CashClosureReadContext, signal?: AbortSignal) => request<CashClosure>('/' + encodeURIComponent(id), context, signal)

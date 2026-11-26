import { getApiBaseUrl, getAuthToken } from '@/services/api'

// Movimientos físicos de efectivo (3B.1): ingresos de fondo, retiros y compensaciones de un turno abierto.
export type CashMovementScope = { companyId: string; branchId: string; actorId: string }
export type CashMovementDirection = 'IN' | 'OUT'
export type CashMovementCapabilities = { available: boolean; canViewOwn: boolean; canViewTeam: boolean; canCreateOwn: boolean; canCreateTeam: boolean; canCorrect: boolean }
export type CashMovement = {
  id: string; direction: CashMovementDirection; amount: string; payment_method_id: number; payment_method_name: string; currency_code: string
  reason: string; counterparty_label: string; reference: string | null; corrects_movement_id: string | null; correction_id: string | null
  actor_id: string; actor_name: string; register_name: string; responsible_name: string; cash_register_session_id: string
  business_timezone: string | null; created_at: string; economic_at: string
}
export type CashMovementReceipt = { id: string; requestKey: string; requestHash: string; replayed: boolean; movement: CashMovement }
export type CashMovementSession = { id: string; register_name: string; register_code: string; opened_by_id: string; responsible_name: string; currency_code: string; opened_at: string; business_timezone: string | null }
export type CashMovementOptions = { available: boolean; sessions: CashMovementSession[]; methods: { id: number; name: string }[] }
export type CashMovementPage = { items: CashMovement[]; totalItems: number; page: number; pageSize: number; totalPages: number; summary?: { inAmount: string; outAmount: string } }
export type CashMovementFilters = { view: 'own' | 'team'; page: number; pageSize: number; direction?: CashMovementDirection; search?: string }
export type CreateCashMovementCommand = { requestKey: string; cashRegisterSessionId: string; direction: CashMovementDirection; amount: string; paymentMethodId: number; reason: string; counterpartyLabel: string; reference?: string }
export type CorrectCashMovementCommand = { requestKey: string; cashRegisterSessionId: string; reason: string; reference?: string }

async function request<T>(path: string, scope: CashMovementScope, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}/cash-closures/physical-movements${path}`, {
    ...options, cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() ?? ''}`, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId },
  })
  let data: { message?: string; code?: string } | null = null
  try { data = await res.json() } catch { if (res.ok) throw Object.assign(new Error('No se pudo leer la respuesta del servidor. Recupera el resultado antes de reintentar.'), { status: res.status }) }
  if (!res.ok) throw Object.assign(new Error(data?.message || 'No se pudo completar la operación de efectivo'), { status: res.status, code: data?.code })
  return data as T
}
export const fetchCashMovementCapabilities = (scope: CashMovementScope, signal?: AbortSignal) => request<CashMovementCapabilities>('/capabilities', scope, { signal })
export const fetchCashMovementOptions = (scope: CashMovementScope, signal?: AbortSignal) => request<CashMovementOptions>('/options', scope, { signal })
export const fetchCashMovement = (id: string, scope: CashMovementScope, signal?: AbortSignal) => request<CashMovement>(`/${encodeURIComponent(id)}`, scope, { signal })
export function listCashMovements(filters: CashMovementFilters, scope: CashMovementScope, signal?: AbortSignal) {
  const query = new URLSearchParams({ view: filters.view, page: String(filters.page), pageSize: String(filters.pageSize) })
  if (filters.direction) query.set('direction', filters.direction)
  if (filters.search?.trim()) query.set('search', filters.search.trim())
  return request<CashMovementPage>(`?${query}`, scope, { signal })
}
export function createCashMovement(command: CreateCashMovementCommand, scope: CashMovementScope) {
  const { requestKey, cashRegisterSessionId, direction, amount, paymentMethodId, reason, counterpartyLabel, reference } = command
  return request<CashMovementReceipt>('', scope, { method: 'POST', body: JSON.stringify({ requestKey, cashRegisterSessionId, direction, amount, paymentMethodId, reason, counterpartyLabel, ...(reference ? { reference } : {}) }) })
}
// La compensación solo envía turno y motivo: el servidor toma importe y sentido del original.
export function correctCashMovement(originalId: string, command: CorrectCashMovementCommand, scope: CashMovementScope) {
  const { requestKey, cashRegisterSessionId, reason, reference } = command
  return request<CashMovementReceipt>(`/${encodeURIComponent(originalId)}/correct`, scope, { method: 'POST', body: JSON.stringify({ requestKey, cashRegisterSessionId, reason, ...(reference ? { reference } : {}) }) })
}

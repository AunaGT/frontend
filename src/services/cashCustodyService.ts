import { getApiBaseUrl, getAuthToken } from '@/services/api'

// Cajas 3B.2: custodias, traslados bilaterales, entrega de turno y fondo retenido.
export type CustodyScope = { companyId: string; branchId: string; actorId: string }
export type CustodyCapabilities = { available: boolean; canView: boolean; canManage: boolean; canOperateOwn: boolean; canOperateTeam: boolean; canReceive: boolean }
export type Custody = { id: string; name: string; currency_code: string; active: boolean; balance: string; pending_in: number }
export type TransferStatus = 'PENDING' | 'RECEIVED' | 'REJECTED'
export type TransferOrigin = { kind: 'SESSION'; sessionId: string } | { kind: 'CUSTODY'; custodyId: string } | { kind: 'FLOAT'; registerId: string }
export type TransferDestination = { kind: 'CUSTODY'; custodyId: string } | { kind: 'REGISTER'; registerId: string }
export type CashTransfer = {
  id: string; status: TransferStatus; amount: string; received_amount: string | null; difference: string | null; currency_code: string
  origin_kind: 'SESSION' | 'CUSTODY' | 'FLOAT' | 'HANDOVER' | 'RETURN'; destination_kind: 'CUSTODY' | 'REGISTER'
  origin_custody_name: string | null; origin_register_name: string | null; destination_custody_name: string | null; destination_register_name: string | null
  sender_id: string; sender_name: string; receiver_id: string | null; receiver_name: string | null; reason: string; reference: string | null; receipt_reason: string | null
  returns_transfer_id: string | null; return_transfer_id: string | null; handover_id: string | null; created_at: string; received_at: string | null
}
export type TransferPage = { items: CashTransfer[]; totalItems: number; page: number; pageSize: number; totalPages: number; summary: { pending: number; toReceive: number; shortage: string } }
export type TransferReceipt = { replayed: boolean; transfer: CashTransfer }
export type CustodyRegister = { id: string; name: string; open_session_id: string | null; opened_by_id: string | null; responsible_name: string | null; retained: string; can_operate?: boolean }
export type Handover = { id: string; delivered_amount: string; retained_amount: string; expected_cash: string | null; difference: string | null; destination_custody_name: string | null; actor_name: string; transfer_id: string | null; transfer_status: TransferStatus | null; created_at: string }
export type HandoverSession = { id: string; status: 'OPEN' | 'CLOSED'; cash_register_id: string; register_name: string; responsible_name: string; opened_by_id: string; opened_at: string; closed_at: string | null; opening_float: string; currency_code: string; business_timezone: string | null }
export type HandoverContext = { session: HandoverSession; eligible: boolean; handover: Handover | null; expectedCash: string | null; registerHasOpenTurn: boolean; custodies: Custody[]; canHandover: boolean }
export type HandoverReceipt = { replayed: boolean; handover: Handover }
export type SendTransferCommand = { requestKey: string; origin: TransferOrigin; destination: TransferDestination; amount: string; reason: string; reference?: string }
export type HandoverCommand = { requestKey: string; deliveredAmount: string; retainedAmount: string; destinationCustodyId?: string; notes?: string }

async function request<T>(path: string, scope: CustodyScope, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}/cash-closures/custody${path}`, {
    ...options, cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() ?? ''}`, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId },
  })
  let data: { message?: string; code?: string } | null = null
  try { data = await res.json() } catch { if (res.ok) throw Object.assign(new Error('No se pudo leer la respuesta del servidor. Recupera el resultado antes de reintentar.'), { status: res.status }) }
  if (!res.ok) throw Object.assign(new Error(data?.message || 'No se pudo completar la operación de efectivo'), { status: res.status, code: data?.code })
  return data as T
}
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
export const fetchCustodyCapabilities = (scope: CustodyScope, signal?: AbortSignal) => request<CustodyCapabilities>('/capabilities', scope, { signal })
export const fetchCustodies = (scope: CustodyScope, signal?: AbortSignal) => request<Custody[]>('/custodies', scope, { signal })
export const createCustody = (name: string, scope: CustodyScope) => request<Custody>('/custodies', scope, post({ name }))
export const setCustodyActive = (id: string, active: boolean, scope: CustodyScope) => request<Custody>(`/custodies/${encodeURIComponent(id)}`, scope, { method: 'PATCH', body: JSON.stringify({ active }) })
export const fetchCustodyDestinations = (scope: CustodyScope, signal?: AbortSignal) => request<{ custodies: Custody[]; registers: CustodyRegister[] }>('/destinations', scope, { signal })
export function listTransfers(filters: { page: number; pageSize: number; status?: TransferStatus; search?: string; toReceive?: boolean }, scope: CustodyScope, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) })
  if (filters.status) query.set('status', filters.status)
  if (filters.toReceive) query.set('direction', 'to_receive')
  if (filters.search?.trim()) query.set('search', filters.search.trim())
  return request<TransferPage>(`/transfers?${query}`, scope, { signal })
}
export const fetchTransfer = (id: string, scope: CustodyScope, signal?: AbortSignal) => request<CashTransfer>(`/transfers/${encodeURIComponent(id)}`, scope, { signal })
export function sendTransfer(command: SendTransferCommand, scope: CustodyScope) {
  const { requestKey, origin, destination, amount, reason, reference } = command
  return request<TransferReceipt>('/transfers', scope, post({ requestKey, origin, destination, amount, reason, ...(reference ? { reference } : {}) }))
}
export const receiveTransfer = (id: string, receivedAmount: string, reason: string | undefined, scope: CustodyScope) =>
  request<TransferReceipt>(`/transfers/${encodeURIComponent(id)}/receive`, scope, post({ receivedAmount, ...(reason ? { reason } : {}) }))
export const rejectTransfer = (id: string, reason: string, scope: CustodyScope) => request<TransferReceipt>(`/transfers/${encodeURIComponent(id)}/reject`, scope, post({ reason }))
export const fetchPendingHandovers = (scope: CustodyScope, signal?: AbortSignal) => request<HandoverSession[]>('/handovers/pending', scope, { signal })
export const fetchHandoverContext = (sessionId: string, scope: CustodyScope, signal?: AbortSignal) => request<HandoverContext>(`/sessions/${encodeURIComponent(sessionId)}/handover`, scope, { signal })
export function handoverTurn(sessionId: string, command: HandoverCommand, scope: CustodyScope) {
  const { requestKey, deliveredAmount, retainedAmount, destinationCustodyId, notes } = command
  return request<HandoverReceipt>(`/sessions/${encodeURIComponent(sessionId)}/handover`, scope, post({ requestKey, deliveredAmount, retainedAmount, ...(destinationCustodyId ? { destinationCustodyId } : {}), ...(notes ? { notes } : {}) }))
}
export const fetchRegisterFloat = (registerId: string, scope: CustodyScope, signal?: AbortSignal) =>
  request<{ available: boolean; amount: string; lastActorName?: string | null }>(`/registers/${encodeURIComponent(registerId)}/float`, scope, { signal })

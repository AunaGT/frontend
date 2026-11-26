import { getApiBaseUrl, getAuthToken } from '@/services/api'

// Cajas 4A: avisos de pago informados por el cliente y su confirmación manual en una caja virtual.
export type NoticeScope = { companyId: string; branchId: string; actorId: string }
export type NoticeCapabilities = { available: boolean; canView: boolean; canCreate: boolean; canConfirm: boolean; evidenceUpload: boolean }
export type NoticeStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED'
export type PaymentNotice = {
  id: string; status: NoticeStatus; amount: string; currency_code: string; customer_id: string; customer_name: string; payment_method_id: number; payment_method_name: string
  reported_paid_on: string; reported_reference: string | null; link_kind: 'SALE' | 'DOCUMENT' | 'ENGAGEMENT' | null; link_id: string | null; notes: string | null
  created_by_name: string; created_at: string; customer_payment_id: string | null; confirmed_by_name: string | null; confirmed_at: string | null; paid_on: string | null
  external_reference: string | null; verification_id: string | null; evidence_path: string | null; register_name: string | null
  rejected_by_name: string | null; rejected_at: string | null; rejection_reason: string | null
}
export type NoticePage = { items: PaymentNotice[]; totalItems: number; page: number; pageSize: number; totalPages: number; summary: { pending: number } }
export type NoticeReceipt = { replayed: boolean; notice: PaymentNotice }
export type VirtualPeriod = { id: string; register_name: string; responsible_name: string; opened_at: string }
export type CreateNoticeCommand = { requestKey: string; customerId: string; amount: string; paymentMethodId: number; reportedPaidOn: string; reportedReference?: string; notes?: string }
export type ConfirmNoticeCommand = { sessionId: string; paidOn: string; externalReference: string; verificationId?: string; evidencePath?: string; attested: true; allowAdvance: boolean }

async function request<T>(path: string, scope: NoticeScope, options: RequestInit = {}): Promise<T> {
  const json = typeof options.body === 'string'
  const res = await fetch(`${getApiBaseUrl()}/cash-closures/notices${path}`, {
    ...options, cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(30_000),
    headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${getAuthToken() ?? ''}`, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId },
  })
  let data: { message?: string; code?: string } | null = null
  try { data = await res.json() } catch { if (res.ok) throw Object.assign(new Error('No se pudo leer la respuesta del servidor. Recupera el resultado antes de reintentar.'), { status: res.status }) }
  if (!res.ok) throw Object.assign(new Error(data?.message || 'No se pudo completar la operación del aviso'), { status: res.status, code: data?.code })
  return data as T
}
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
export const fetchNoticeCapabilities = (scope: NoticeScope, signal?: AbortSignal) => request<NoticeCapabilities>('/capabilities', scope, { signal })
export function listNotices(filters: { page: number; pageSize: number; status?: NoticeStatus; search?: string }, scope: NoticeScope, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) })
  if (filters.status) query.set('status', filters.status)
  if (filters.search?.trim()) query.set('search', filters.search.trim())
  return request<NoticePage>(`?${query}`, scope, { signal })
}
export const fetchNotice = (id: string, scope: NoticeScope, signal?: AbortSignal) => request<PaymentNotice>(`/${encodeURIComponent(id)}`, scope, { signal })
export const fetchVirtualPeriods = (scope: NoticeScope, signal?: AbortSignal) => request<VirtualPeriod[]>('/periods', scope, { signal })
export const createNotice = (command: CreateNoticeCommand, scope: NoticeScope) => request<NoticeReceipt>('', scope, post(command))
export const confirmNotice = (id: string, command: ConfirmNoticeCommand, scope: NoticeScope) => request<NoticeReceipt>(`/${encodeURIComponent(id)}/confirm`, scope, post(command))
export const rejectNotice = (id: string, reason: string, scope: NoticeScope) => request<NoticeReceipt>(`/${encodeURIComponent(id)}/reject`, scope, post({ reason }))
export function uploadNoticeEvidence(file: File, scope: NoticeScope) {
  const body = new FormData(); body.append('file', file)
  return request<{ path: string; mimeType: string; size: number }>('/evidence', scope, { method: 'POST', body })
}
export const fetchNoticeEvidence = (id: string, scope: NoticeScope) => request<{ url: string; expiresAt: string }>(`/${encodeURIComponent(id)}/evidence`, scope)

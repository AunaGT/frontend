import { getApiBaseUrl, getAuthToken } from '@/services/api'

// Cajas 4B: medios bancarios directo/diferido (propone el gestor, aprueba el admin), depósitos y liquidaciones por sucursal.
export type SettlementScope = { companyId: string; branchId: string; actorId: string }
export type SettlementCapabilities = { available: boolean; canManage: boolean; canApprove: boolean; canSettle: boolean }
export type BankMode = 'DIRECT' | 'DEFERRED'
export type MethodVersion = { id: string; version: number; mode: BankMode; destination_label: string; status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'SUPERSEDED'
  bank_account_id: number | null; clearing_account_id: number | null; fee_account_id: number | null; bank_account_label: string | null; clearing_account_label: string | null; fee_account_label: string | null
  proposed_by_name: string; proposed_at: string; decided_by_name: string | null; decided_at: string | null; decision_reason: string | null }
export type BankMethod = { payment_method_id: number; name: string; suggested_mode: BankMode | null; accounting: boolean; active: MethodVersion | null; proposal: MethodVersion | null }
export type EligibleAccount = { id: number; code: string; name: string; type: 'ASSET' | 'EXPENSE' }
export type ProposeCommand = { paymentMethodId: number; mode: BankMode; destinationLabel: string; bankAccountId?: number | null; clearingAccountId?: number | null; feeAccountId?: number | null }
export type PendingReceipt = { event_id: string; source_type: string; direction: 'IN' | 'OUT'; payment_method_id: number; payment_method_name: string; reference: string | null; economic_at: string; amount: string; remaining: string }
export type DeductionKind = 'FEE' | 'CHARGEBACK' | 'OTHER'
export type Settlement = { id: string; status: 'POSTED' | 'VOIDED'; deposit_id: string; deposit_reference: string; deposited_on: string; deposit_total: string; payment_method_name: string
  gross: string; refunds: string; deductions_total: string; net: string; entry_number: string | null; void_entry_number: string | null; created_by_name: string; created_at: string
  void_reason: string | null; voided_by_name: string | null; voided_at: string | null
  allocations: { event_id: string; amount: string; source_type: string; economic_at: string; reference: string | null }[]
  deductions: { kind: DeductionKind; amount: string; description: string; account_label: string | null; event_id: string | null }[] }
export type SettlementRow = { id: string; status: 'POSTED' | 'VOIDED'; net: string; gross: string; deductions: string; deposit_reference: string; deposited_on: string; payment_method_name: string; created_at: string }
export type Deposit = { id: string; reference: string; deposited_on: string; total_amount: string; distributed: string; pending: string; payment_method_name: string; settlements: { id: string; status: string; net: string; branch_name: string }[] }
export type CreateSettlementCommand = { requestKey: string; paymentMethodId: number; deposit: { id: string } | { reference: string; depositedOn: string; totalAmount: string }; net: string
  allocations: { eventId: string; amount: string }[]; deductions: { kind: DeductionKind; amount: string; description: string; accountId?: number | null; eventId?: string | null }[] }

async function request<T>(path: string, scope: SettlementScope, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}/cash-closures${path}`, {
    ...options, cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() ?? ''}`, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId },
  })
  let data: { message?: string; code?: string } | null = null
  try { data = await res.json() } catch { if (res.ok) throw Object.assign(new Error('No se pudo leer la respuesta del servidor. Recupera el resultado antes de reintentar.'), { status: res.status }) }
  if (!res.ok) throw Object.assign(new Error(data?.message || 'No se pudo completar la operación'), { status: res.status, code: data?.code })
  return data as T
}
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
export const fetchSettlementCapabilities = (scope: SettlementScope, signal?: AbortSignal) => request<SettlementCapabilities>('/settlements/capabilities', scope, { signal })
export const fetchBankMethods = (scope: SettlementScope, signal?: AbortSignal) => request<BankMethod[]>('/bank-methods', scope, { signal })
export const fetchEligibleAccounts = (scope: SettlementScope, signal?: AbortSignal) => request<{ assets: EligibleAccount[]; expenses: EligibleAccount[] }>('/bank-methods/accounts', scope, { signal })
export const proposeBankMethod = (command: ProposeCommand, scope: SettlementScope) => request<{ version: MethodVersion }>('/bank-methods', scope, post(command))
export const approveBankMethod = (id: string, scope: SettlementScope) => request<{ version: MethodVersion }>(`/bank-methods/${encodeURIComponent(id)}/approve`, scope, post({}))
export const rejectBankMethod = (id: string, reason: string, scope: SettlementScope) => request<{ version: MethodVersion }>(`/bank-methods/${encodeURIComponent(id)}/reject`, scope, post({ reason }))
export const withdrawBankMethod = (id: string, scope: SettlementScope) => request<{ version: MethodVersion }>(`/bank-methods/${encodeURIComponent(id)}/withdraw`, scope, post({}))
export const fetchPendingReceipts = (scope: SettlementScope, paymentMethodId?: number, signal?: AbortSignal) => request<{ items: PendingReceipt[]; totals: Record<string, string> }>(`/settlements/pending${paymentMethodId ? `?paymentMethodId=${paymentMethodId}` : ''}`, scope, { signal })
export const listSettlements = (page: number, scope: SettlementScope, signal?: AbortSignal) => request<{ items: SettlementRow[]; totalItems: number; page: number; pageSize: number; totalPages: number }>(`/settlements?page=${page}&pageSize=20`, scope, { signal })
export const fetchSettlement = (id: string, scope: SettlementScope, signal?: AbortSignal) => request<Settlement>(`/settlements/${encodeURIComponent(id)}`, scope, { signal })
export const findDeposit = (paymentMethodId: number, reference: string, scope: SettlementScope) => request<Deposit | null>(`/settlements/deposits/lookup?paymentMethodId=${paymentMethodId}&reference=${encodeURIComponent(reference)}`, scope)
export const createSettlement = (command: CreateSettlementCommand, scope: SettlementScope) => request<{ replayed: boolean; settlement: Settlement }>('/settlements', scope, post(command))
export const voidSettlement = (id: string, reason: string, scope: SettlementScope) => request<{ replayed: boolean; settlement: Settlement }>(`/settlements/${encodeURIComponent(id)}/void`, scope, post({ reason }))

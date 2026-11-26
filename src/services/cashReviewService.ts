import { getApiBaseUrl, getAuthToken } from '@/services/api'

// Cajas 3C: política de diferencias, revisión con reconteo y estado visible del turno.
export type ReviewScope = { companyId: string; branchId: string; actorId: string }
export type ReviewCapabilities = { available: boolean; canReview: boolean; canManagePolicy: boolean; canDeclare: boolean; isAdmin: boolean }
export type ReviewResult = 'CLEAN' | 'WITHIN' | 'REVIEW'
export type ReviewLine = { payment_method_id: number; name: string; kind: 'CASH' | 'DIGITAL'; expected: string; actual: string; difference: string; status: ReviewResult }
export type PolicySnapshot = { source: 'DEFAULT' | 'COMPANY' | 'BRANCH'; revision: number; cash_threshold: string; digital_threshold: string; blind_count: boolean }
export type ReviewAction = { action: 'RECOUNT_REQUESTED' | 'DIFFERENCES_ACCEPTED' | 'FINALIZED'; reason: string | null; self_review?: boolean; actor_name: string; created_at: string }
export type ReviewHistoryItem = { id: string; closure_number: number; actual_total: string; difference: string; review_result: ReviewResult; review_classification: { lines: ReviewLine[] }; created_at: string; reviews: ReviewAction[] | null }
export type ClosureReview = {
  id: string; status: string; review_flow_version: 1; review_result: ReviewResult; updated_at: string; supersedes_closure_id: string | null; superseded_by_id: string | null; self: boolean
  policy_snapshot: PolicySnapshot; review_classification: { lines: ReviewLine[] }; reviews: ReviewAction[]; history: ReviewHistoryItem[]; can: { finalize: boolean; recount: boolean }
}
export type Policy = { cash_threshold: string; digital_threshold: string; blind_count: boolean; owner_self_review: boolean; revision: number; updated_at?: string; updated_by_name?: string }
export type Policies = { company: Policy | null; branch: Policy | null; effective: Policy & { source: PolicySnapshot['source'] } }
export type SavePolicyCommand = { branchId: string | null; cashThreshold: string; digitalThreshold: string; blindCount: boolean; ownerSelfReview?: boolean; expectedRevision: number }

async function request<T>(path: string, scope: ReviewScope, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}/cash-closures${path}`, {
    ...options, cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() ?? ''}`, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId },
  })
  let data: { message?: string; code?: string } | null = null
  try { data = await res.json() } catch { if (res.ok) throw Object.assign(new Error('No se pudo leer la respuesta del servidor. Recarga antes de reintentar.'), { status: res.status }) }
  if (!res.ok) throw Object.assign(new Error(data?.message || 'No se pudo completar la revisión del arqueo'), { status: res.status, code: data?.code })
  return data as T
}
const post = (body: unknown, method = 'POST') => ({ method, body: JSON.stringify(body) })
export const fetchReviewCapabilities = (scope: ReviewScope, signal?: AbortSignal) => request<ReviewCapabilities>('/review/capabilities', scope, { signal })
export const fetchPolicies = (scope: ReviewScope, signal?: AbortSignal) => request<Policies>('/review/policy', scope, { signal })
export const savePolicy = (command: SavePolicyCommand, scope: ReviewScope) => request<Policies>('/review/policy', scope, post(command, 'PUT'))
// 404 significa arqueo del flujo anterior (o sin acceso): la página sigue con Aprobar/Rechazar.
export async function fetchClosureReview(id: string, scope: ReviewScope, signal?: AbortSignal): Promise<ClosureReview | null> {
  try { return await request<ClosureReview>(`/${encodeURIComponent(id)}/review`, scope, { signal }) }
  catch (e) { if ((e as { status?: number }).status === 404) return null; throw e }
}
export const finalizeClosure = (id: string, input: { expectedUpdatedAt: string; reason?: string }, scope: ReviewScope) => request<ClosureReview>(`/${encodeURIComponent(id)}/finalize`, scope, post(input))
export const requestRecount = (id: string, input: { expectedUpdatedAt: string; reason: string }, scope: ReviewScope) => request<ClosureReview>(`/${encodeURIComponent(id)}/recount`, scope, post(input))

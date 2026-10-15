import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { apiFetch, ApiError, getActiveCompanyId, getActiveBranchId } from '@/services/api'
import type { PaymentMethodDto, PaymentMethodScope, SettlementKind } from '@/services/paymentMethodsService'
import { PAYMENT_METHODS_QUERY_KEY } from '@/hooks/usePaymentMethods'
export { PAYMENT_METHODS_QUERY_KEY }
export interface PaymentMethodCatalog extends PaymentMethodDto {
  _count?: Partial<Record<'sales' | 'cash_closure_payments' | 'customer_payments' | 'supplier_payments' | 'return_settlements' | 'customer_payment_refunds', number>>
}
export interface PaymentMethodsCatalogParams {
  page?: number; pageSize?: number; search?: string; order?: 'asc' | 'desc'; includeSummary?: boolean; state?: 'all' | 'active' | 'inactive'
}
export interface PaymentMethodsCatalogResponse {
  items: PaymentMethodCatalog[]; page: number; pageSize: number; totalPages: number; totalItems: number; nextPage: number | null; prevPage: number | null
  summary?: { total: number; active: number; inactive: number; immediate: number; credit: number }
}
export function paymentMethodUsageCounts(m: PaymentMethodCatalog) {
  return { sales: m._count?.sales ?? 0, closures: m._count?.cash_closure_payments ?? 0, total: Object.values(m._count ?? {}).reduce((sum, n) => sum + n, 0) }
}
export function usePaymentMethodsCatalog(params: PaymentMethodsCatalogParams = {}) {
  const { company, branch } = useTenant(), companyId = company?.id ?? null
  const { page = 1, pageSize = 10, search = '', order = 'asc', state = 'all', includeSummary = false } = params
  const headers = { 'X-Company-Id': companyId!, 'X-Branch-Id': branch?.id ?? 'all' }
  return useQuery<PaymentMethodsCatalogResponse>({
    queryKey: [...PAYMENT_METHODS_QUERY_KEY, companyId, 'catalog', page, pageSize, search, order, state, includeSummary],
    enabled: Boolean(companyId),
    queryFn: ({ signal }) => {
      const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search: search.trim(), order, state })
      if (includeSummary) q.set('includeSummary', 'true')
      return apiFetch<PaymentMethodsCatalogResponse>(`/catalogs/payment-methods?${q}`, { signal, headers })
    }, staleTime: 60_000,
  })
}
export function paymentMethodScopeChanged(error: unknown) { return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'PM_CONTEXT_CHANGED') }
function checkScope(scope: PaymentMethodScope) {
  if (!scope.companyId || !scope.branchId || scope.branchId === 'all' || scope.companyId !== getActiveCompanyId() || scope.branchId !== getActiveBranchId())
    throw Object.assign(new Error('La empresa o sucursal cambió. Abre el formulario nuevamente'), { code: 'PM_CONTEXT_CHANGED' })
}
type MutationInput<T> = PaymentMethodScope & { id?: number; data: T }
function useMethodMutation<T>(method: 'POST' | 'PUT' | 'DELETE') {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (variables: MutationInput<T>) => {
      checkScope(variables)
      const result = await apiFetch<PaymentMethodCatalog>(`/catalogs/payment-methods${method === 'POST' ? '' : '/' + variables.id}`, {
        method, headers: { 'X-Company-Id': variables.companyId, 'X-Branch-Id': variables.branchId },
        ...(method === 'DELETE' ? {} : { body: JSON.stringify(variables.data) }),
      })
      checkScope(variables)
      return result
    },
    onSettled: (_data, _error, variables) => client.invalidateQueries({ queryKey: [...PAYMENT_METHODS_QUERY_KEY, variables.companyId] }),
  })
}
export const useCreatePaymentMethod = () => useMethodMutation<{ name: string; settlement_kind: SettlementKind }>('POST')
export const useUpdatePaymentMethod = () => useMethodMutation<{ name?: string; enabled?: boolean; position?: number }>('PUT')
export const useDeletePaymentMethod = () => useMethodMutation<undefined>('DELETE')
export function catalogApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback
  return error && typeof error === 'object' && 'message' in error ? String(error.message || fallback) : fallback
}

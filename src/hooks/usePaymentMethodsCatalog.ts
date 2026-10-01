/**
 * CRUD de métodos de pago (Datos maestros). El listado simple para POS sigue en usePaymentMethods.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiError } from '@/services/api'

export interface PaymentMethodCatalog {
  id: number
  name: string
  _count?: {
    sales?: number
    cash_closure_payments?: number
  }
}

import { PAYMENT_METHODS_QUERY_KEY } from '@/hooks/usePaymentMethods'

export { PAYMENT_METHODS_QUERY_KEY }
export const PAYMENT_METHODS_CATALOG_QUERY_KEY = ['payment-methods', 'catalog'] as const

export interface PaymentMethodsCatalogParams {
  page?: number
  pageSize?: number
  search?: string
  order?: 'asc' | 'desc'
}

export interface PaymentMethodsCatalogResponse {
  items: PaymentMethodCatalog[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  nextPage: number | null
  prevPage: number | null
}

export function paymentMethodUsageCounts(m: PaymentMethodCatalog) {
  const sales = m._count?.sales ?? 0
  const closures = m._count?.cash_closure_payments ?? 0
  return { sales, closures, total: sales + closures }
}

export function usePaymentMethodsCatalog(params?: PaymentMethodsCatalogParams) {
  const { page = 1, pageSize = 20, search = '', order = 'asc' } = params || {}

  return useQuery<PaymentMethodsCatalogResponse>({
    queryKey: [...PAYMENT_METHODS_CATALOG_QUERY_KEY, page, pageSize, search, order],
    queryFn: async () => {
      const q = new URLSearchParams()
      q.set('page', String(page))
      q.set('pageSize', String(pageSize))
      if (search.trim()) q.set('search', search.trim())
      q.set('order', order)
      return apiFetch<PaymentMethodsCatalogResponse>(`/catalogs/payment-methods?${q.toString()}`)
    },
    staleTime: 60 * 1000,
  })
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string }) =>
      apiFetch<PaymentMethodCatalog>('/catalogs/payment-methods', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_CATALOG_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_QUERY_KEY })
    },
  })
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string } }) =>
      apiFetch<PaymentMethodCatalog>(`/catalogs/payment-methods/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_CATALOG_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_QUERY_KEY })
    },
  })
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      apiFetch(`/catalogs/payment-methods/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_CATALOG_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_QUERY_KEY })
    },
  })
}

export function catalogApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message || fallback)
  }
  return fallback
}

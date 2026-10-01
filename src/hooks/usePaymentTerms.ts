/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../services/api'

export interface PaymentTerm {
  id: number
  name: string
  /** Días naturales hasta vencimiento sugerido (ingreso de mercancía) */
  net_days?: number | null
  deleted: boolean
  _count?: {
    /** Relación N:M proveedor–término (schema actual) */
    supplier_payment_terms?: number
    /** Compat: respuestas antiguas con relación directa */
    suppliers?: number
  }
}

export const PAYMENT_TERMS_QUERY_KEY = ["paymentTerms"] as const;

export interface PaymentTermsQueryParams {
  page?: number
  pageSize?: number
  includeDeleted?: boolean
  search?: string
  order?: 'asc' | 'desc'
}

export interface PaymentTermsResponse {
  items: PaymentTerm[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  nextPage: number | null
  prevPage: number | null
}

// Obtener términos de pago con paginación
export function usePaymentTerms(params?: PaymentTermsQueryParams) {
  const { page = 1, pageSize = 20, includeDeleted = false, search: query = '', order = 'asc' } = params || {}
  
  return useQuery<PaymentTermsResponse>({
    queryKey: [...PAYMENT_TERMS_QUERY_KEY, page, pageSize, includeDeleted, query, order],
    queryFn: async () => {
      const search = new URLSearchParams()
      if (page) search.set('page', String(page))
      if (pageSize) search.set('pageSize', String(pageSize))
      if (includeDeleted) search.set('includeDeleted', 'true')
      if (query.trim()) search.set('search', query.trim())
      search.set('order', order)
      
      const url = `/catalogs/payment-terms${search.toString() ? `?${search.toString()}` : ''}`
      return apiFetch<PaymentTermsResponse>(url)
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Crear término de pago
export function useCreatePaymentTerm() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: { name: string; net_days?: number | null }) => {
      return apiFetch<PaymentTerm>('/catalogs/payment-terms', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_TERMS_QUERY_KEY })
    },
  })
}

// Actualizar término de pago
export function useUpdatePaymentTerm() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: { name: string; net_days?: number | null }
    }) => {
      return apiFetch<PaymentTerm>(`/catalogs/payment-terms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_TERMS_QUERY_KEY })
    },
  })
}

// Eliminar término de pago (soft delete)
export function useDeletePaymentTerm() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      return apiFetch(`/catalogs/payment-terms/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_TERMS_QUERY_KEY })
    },
  })
}

// Restaurar término de pago
export function useRestorePaymentTerm() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      return apiFetch(`/catalogs/payment-terms/${id}/restore`, { method: 'PATCH' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_TERMS_QUERY_KEY })
    },
  })
}

/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { apiFetch } from '@/services/api'

export interface ReturnStatus {
  id: number
  name: string
}

export interface ReturnItem {
  id: number
  return_id: string
  sale_item_id: number
  product_id: string
  qty_returned: number
  refund_amount: number
  reason?: string | null
  product?: {
    id: string
    name: string
    barcode?: string | null
  }
  sale_item?: {
    id: number
    price: number
    qty: number
  }
}

export type ReturnType = 'REFUND' | 'EXCHANGE'

export interface ReturnReplacementItem {
  id: number
  return_id: string
  product_id: string
  qty: number
  unit_price: number
  line_total: number
  product?: {
    id: string
    name: string
    barcode?: string | null
  }
}

export interface Return {
  id: string
  sale_id: string
  return_date: string
  type: ReturnType
  reason?: string | null
  total_refund: number
  price_difference: number
  items_count: number
  status_id: number
  processed_by?: string | null
  processed_at?: string | null
  notes?: string | null
  status: ReturnStatus
  return_items: ReturnItem[]
  replacement_items?: ReturnReplacementItem[]
  sale?: {
    id: string
    customer?: string | null
    date: string
    total: number
    status: {
      id: number
      name: string
    }
    payment_method: {
      id: number
      name: string
    }
    branch?: { id: string; name: string; code: string } | null
  }
  _stockAdjustment?: string
  _transition?: string
}

export interface CreateReturnPayload {
  sale_id: string
  type?: ReturnType
  reason?: string
  notes?: string
  items: {
    sale_item_id: number
    product_id: string
    qty_returned: number
    reason?: string
  }[]
  // Solo para cambios (type === 'EXCHANGE'): productos que se lleva el cliente.
  replacements?: {
    product_id: string
    qty: number
    unit_price: number
  }[]
}

export interface UpdateReturnStatusPayload {
  status_name: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Completada'
  restore_stock?: boolean // Solo aplica cuando status_name = 'Aprobada'
}

export interface ReturnListResponse {
  items: Return[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  nextPage: number | null
  prevPage: number | null
}

/**
 * Fetch all returns with optional filters
 */
export const fetchReturns = async (params?: {
  status?: string
  sale_id?: string
  page?: number
  pageSize?: number
}): Promise<ReturnListResponse> => {
  const queryParams = new URLSearchParams()
  
  if (params?.status) queryParams.append('status', params.status)
  if (params?.sale_id) queryParams.append('sale_id', params.sale_id)
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())

  const response = await apiFetch<ReturnListResponse>(
    `/returns${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
    { method: 'GET' }
  )
  return response
}

/**
 * Fetch a specific return by ID
 */
export const fetchReturnById = async (id: string): Promise<Return> => {
  const response = await apiFetch<Return>(`/returns/${id}`, {
    method: 'GET'
  })
  return response
}

/**
 * Create a new return
 */
export const createReturn = async (payload: CreateReturnPayload): Promise<Return> => {
  const response = await apiFetch<Return>('/returns', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return response
}

/**
 * Update return status
 */
export const updateReturnStatus = async (
  id: string,
  payload: UpdateReturnStatusPayload
): Promise<Return> => {
  const response = await apiFetch<Return>(`/returns/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
  return response
}

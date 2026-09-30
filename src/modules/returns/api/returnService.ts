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
  received_qty?: number | null
  restock_qty?: number | null
  disposition?: 'SELLABLE' | 'QUARANTINE' | 'SCRAP' | null
  stock_location_id?: string | null
  product?: {
    id: string
    name: string
    barcode?: string | null
    image_url?: string | null
  }
  sale_item?: {
    id: number
    price: number
    qty: number
  }
}

export type ReturnType = 'REFUND' | 'EXCHANGE'
export type ReturnResolution = 'REFUND_ORIGINAL' | 'REFUND_CASH' | 'REFUND_TRANSFER' | 'CUSTOMER_CREDIT' | 'EXCHANGE'

export interface ReturnPolicy {
  windowDays: number
  allowAuthorizedExceptions: boolean
  exchangePricing: 'CURRENT_PRICE' | 'ORIGINAL_SALE_PRICE'
  enabledResolutions: ReturnResolution[]
}

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
  reference?: string | null
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
  requested_resolution?: ReturnResolution | null
  approved_resolution?: ReturnResolution | null
  approved_at?: string | null
  approved_by?: string | null
  replacement_sale_id?: string | null
  return_policy?: ReturnPolicy
  actors?: {
    approved_by?: { id: string; name?: string | null; email?: string | null } | null
    processed_by?: { id: string; name?: string | null; email?: string | null } | null
    policy_overridden_by?: { id: string; name?: string | null; email?: string | null } | null
  }
  fiscal?: { requires_credit_note: boolean; status: string; original_documents: Array<{ id: string; authorization?: string | null; series?: string | null; number?: string | null }> }
  settlements?: Array<{
    id: string
    kind: 'REFUND' | 'COLLECTION' | 'CUSTOMER_CREDIT' | 'CREDIT_OFFSET'
    amount: number
    external_reference?: string | null
    created_at: string
    payment_method?: { id: number; name: string } | null
    cash_register_session?: { id: string; cashRegister?: { id: string; name: string; code: string } | null } | null
  }>
  status: ReturnStatus
  return_items: ReturnItem[]
  replacement_items?: ReturnReplacementItem[]
  sale?: {
    id: string
    reference?: string | null
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
    customerContact?: { id: string; name: string } | null
    sale_dtes?: Array<{ id: string; status?: string | null; authorization?: string | null }>
    sale_items?: Array<{ id: number; qty: number; price: number; product: { id: string; name: string; barcode?: string | null; image_url?: string | null } }>
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
  policy_override_reason?: string
  requested_resolution?: ReturnResolution
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
    unit_price?: number
  }[]
}

export interface ApproveReturnPayload {
  approved_resolution: ReturnResolution
  lines: Array<{ return_item_id: number; disposition: 'SELLABLE' | 'QUARANTINE' | 'SCRAP'; stock_location_id?: string | null }>
  replacements?: Array<{ product_id: string; qty: number }>
}

export interface CompleteReturnPayload {
  idempotency_key: string
  lines: Array<{ return_item_id: number; received_qty: number; disposition: 'SELLABLE' | 'QUARANTINE' | 'SCRAP'; stock_location_id?: string | null }>
  settlement: { payment_method_id?: number; cash_register_session_id?: string; external_reference?: string; channel?: 'ORIGINAL' | 'CASH' | 'TRANSFER' | 'CUSTOMER_CREDIT' }
}

export interface UpdateReturnStatusPayload {
  status_name: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Completada'
  restore_stock?: boolean // Solo aplica cuando status_name = 'Aprobada'
}

export interface EligibleSaleItem {
  id: number
  qty: number
  price: number
  product_id: string
  available_to_return: number
  estimated_unit_refund: number
  product: { id: string; name: string; barcode?: string | null; image_url?: string | null }
}

export interface EligibleSale {
  id: string
  reference?: string | null
  date: string
  total: number
  customer?: string | null
  customerContact?: { id: string; name: string } | null
  sale_items: EligibleSaleItem[]
  eligible: boolean
  days_elapsed: number
  eligibility_reasons: Array<'SALE_NOT_COMPLETED' | 'NO_RETURNABLE_UNITS' | 'RETURN_WINDOW_EXPIRED'>
  return_policy: ReturnPolicy
}

export interface EligibleSalesResponse {
  items: EligibleSale[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  nextPage: number | null
  prevPage: number | null
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
  search?: string
  type?: string
  reason?: string
  date_from?: string
  date_to?: string
  page?: number
  pageSize?: number
}): Promise<ReturnListResponse> => {
  const queryParams = new URLSearchParams()
  
  if (params?.status) queryParams.append('status', params.status)
  if (params?.sale_id) queryParams.append('sale_id', params.sale_id)
  if (params?.search) queryParams.append('search', params.search)
  if (params?.type) queryParams.append('type', params.type)
  if (params?.reason) queryParams.append('reason', params.reason)
  if (params?.date_from) queryParams.append('date_from', params.date_from)
  if (params?.date_to) queryParams.append('date_to', params.date_to)
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())

  const response = await apiFetch<ReturnListResponse>(
    `/returns${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
    { method: 'GET' }
  )
  return response
}

export const fetchEligibleSales = async (params?: {
  search?: string
  sale_id?: string
  page?: number
  pageSize?: number
}): Promise<EligibleSalesResponse> => {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.sale_id) query.set('sale_id', params.sale_id)
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('pageSize', String(params.pageSize))
  return apiFetch(`/returns/eligible-sales${query.size ? `?${query}` : ''}`, { method: 'GET' })
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

export const approveReturn = (id: string, payload: ApproveReturnPayload): Promise<Return> => apiFetch(`/returns/${id}/approve`, {
  method: 'POST', body: JSON.stringify(payload),
})

export const completeReturn = (id: string, payload: CompleteReturnPayload): Promise<Return> => apiFetch(`/returns/${id}/complete`, {
  method: 'POST', body: JSON.stringify(payload),
})

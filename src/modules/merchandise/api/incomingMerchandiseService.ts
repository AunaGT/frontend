/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { apiFetch, getApiBaseUrl, getAuthToken } from '@/services/api'

export interface IncomingMerchandiseItem {
  id: string
  product: {
    id: string
    name: string
    brand?: string | null
    size?: string | null
    barcode?: string | null
    cost?: number
    price?: number
    stock?: number
  }
  quantity: number
  unit_cost: number
  subtotal: number
}

export type MerchandisePaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID'

export interface IncomingMerchandisePaymentEntry {
  id: string
  amount: number
  paid_at: string
  reference?: string | null
  registered_by?: { id: string; name: string; email?: string | null } | null
}

export interface IncomingMerchandise {
  id: string
  supplier: {
    id: string
    name: string
    contact?: string | null
    email?: string | null
    phone?: string | null
  }
  registeredBy: {
    id: string
    name: string
    email?: string | null
  }
  date: string
  notes?: string | null
  payment_term?: { id: number; name: string; net_days?: number | null } | null
  payment_status?: MerchandisePaymentStatus
  paid_at?: string | null
  payment_reference?: string | null
  due_date?: string | null
  payment_updated_at?: string | null
  payment_updated_by?: { id: string; name: string; email?: string | null } | null
  itemsCount: number
  totalValue: number
  items: IncomingMerchandiseItem[]
  /** Solo en detalle GET /:id */
  payment_entries?: IncomingMerchandisePaymentEntry[]
  amount_paid_total?: number
  amount_pending?: number
}

export interface IncomingMerchandiseQueryParams {
  page?: number
  pageSize?: number
  supplier_id?: string
  start_date?: string
  end_date?: string
  search?: string
  /** Filtrar por estado de pago del ingreso */
  payment_status?: MerchandisePaymentStatus
  /** Si es false, la query no se ejecuta (para uso en hooks). No se envía al API. */
  enabled?: boolean
}

export interface IncomingMerchandiseResponse {
  items: IncomingMerchandise[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  nextPage: number | null
  prevPage: number | null
}

export const fetchIncomingMerchandise = async (
  params?: IncomingMerchandiseQueryParams
): Promise<IncomingMerchandiseResponse> => {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.pageSize) search.set('pageSize', String(params.pageSize))
  if (params?.supplier_id) search.set('supplier_id', params.supplier_id)
  if (params?.start_date) search.set('start_date', params.start_date)
  if (params?.end_date) search.set('end_date', params.end_date)
  if (params?.search) search.set('search', params.search)
  if (params?.payment_status) search.set('payment_status', params.payment_status)

  const url = `/api/incoming-merchandise${search.toString() ? `?${search.toString()}` : ''}`
  return apiFetch<IncomingMerchandiseResponse>(url, { method: 'GET' })
}

export const getIncomingMerchandiseById = async (id: string): Promise<IncomingMerchandise> => {
  return apiFetch<IncomingMerchandise>(`/api/incoming-merchandise/${id}`, { method: 'GET' })
}

export interface PatchIncomingMerchandisePaymentPayload {
  payment_status?: MerchandisePaymentStatus
  payment_term_id?: number | null
  paid_at?: string | null
  payment_reference?: string | null
  due_date?: string | null
}

export const patchIncomingMerchandisePayment = async (
  id: string,
  payload: PatchIncomingMerchandisePaymentPayload
): Promise<IncomingMerchandise> => {
  return apiFetch<IncomingMerchandise>(`/api/incoming-merchandise/${id}/payment`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export interface PostIncomingMerchandisePaymentBody {
  amount: number
  paid_at?: string
  reference?: string | null
}

export const postIncomingMerchandisePayment = async (
  id: string,
  body: PostIncomingMerchandisePaymentBody
): Promise<IncomingMerchandise> => {
  return apiFetch<IncomingMerchandise>(`/api/incoming-merchandise/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export const deleteIncomingMerchandisePayment = async (
  id: string,
  entryId: string
): Promise<IncomingMerchandise> => {
  return apiFetch<IncomingMerchandise>(`/api/incoming-merchandise/${id}/payments/${entryId}`, {
    method: 'DELETE',
  })
}

export const generateMerchandiseReport = async (params?: {
  supplier_id?: string
  start_date?: string
  end_date?: string
  payment_status?: MerchandisePaymentStatus
}): Promise<Blob> => {
  const search = new URLSearchParams()
  if (params?.supplier_id) search.set('supplier_id', params.supplier_id)
  if (params?.start_date) search.set('start_date', params.start_date)
  if (params?.end_date) search.set('end_date', params.end_date)
  if (params?.payment_status) search.set('payment_status', params.payment_status)

  /** Misma base que `apiFetch`: VITE_API_URL ya incluye `/api`; no anteponer otro `/api`. */
  const path = `/incoming-merchandise/report/pdf${search.toString() ? `?${search.toString()}` : ''}`
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getAuthToken() ?? ''}`,
    },
  })

  if (!response.ok) {
    throw new Error('Error al generar el reporte')
  }

  return response.blob()
}

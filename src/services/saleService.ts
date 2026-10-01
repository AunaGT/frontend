/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { apiFetch } from "./api";

export interface SaleItemPayload {
  product_id: string;
  price: number;
  qty: number;
}

export interface CreateSalePayload {
  customer: string;
  customer_nit: string;
  is_final_consumer: boolean;
  payment_method_id: number;
  status_id: number;
  /** Cliente del maestro (UUID) si se eligió en POS */
  customer_contact_id?: string;
  /** Canal para resolución de precios y auditoría */
  sales_channel?: string;
  /** Caja seleccionada en el POS; el backend valida el turno abierto contra ella */
  cash_register_id?: string;
  /** Clave del intento de cobro: reintentar con la misma devuelve la venta ya creada */
  idempotency_key?: string;
  items: SaleItemPayload[];
}

export interface SaleItem {
  id: number;
  product_id: string;
  product: {
    id: string;
    name: string;
    barcode?: string;
  };
  price: number;
  qty: number;
}

/** Documento tributario electrónico (certificación SAT/InFile) vinculado a la venta */
export interface SaleDte {
  id: string;
  sale_id: string;
  document_type?: string;
  authorization?: string;
  series?: string;
  number?: string;
  emission_date?: string;
  status?: string;
  provider?: string;
  xml_url?: string;
  pdf_url?: string;
}

export interface ReturnDetail {
  id: string;
  return_date: string;
  reason?: string;
  total_refund: number;
  status: {
    id: number;
    name: string;
  };
  return_items: Array<{
    id: number;
    product: {
      id: string;
      name: string;
      barcode?: string;
    };
    qty_returned: number;
    refund_amount: number;
  }>;
}

export interface Sale {
  payment_status?: 'PENDING' | 'PARTIAL' | 'PAID';
  due_date?: string | null;
  paymentEntries?: Array<{ amount: number | string }>;
  id: string;
  /** Referencia legible (ej. V-000001). Generada en backend al crear la venta. */
  reference?: string;
  date: string;
  customer?: string;
  customer_nit?: string;
  is_final_consumer: boolean;
  subtotal?: number;
  discount_total?: number;
  total: number;
  total_returned?: number;
  adjusted_total?: number;
  items: number;
  amount_received?: number;
  change?: number;
  created_by?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  status: {
    id: number;
    name: string;
  };
  payment_method: {
    id: number;
    name: string;
    is_credit?: boolean;
  };
  sale_items: SaleItem[];
  sale_dtes?: SaleDte[];
  returns?: ReturnDetail[];
}

/** Misma forma que GET /sales/:id — el POST devuelve la venta completa para evitar un GET extra (ticket, etc.). */
export type CreateSaleResponse = Sale;

/** Presente en GET /sales?customer_contact_id=… — totales solo ventas «Completada». */
export interface CustomerPurchaseSummary {
  totalPurchases: number;
  lastSaleDate: string | null;
}

export interface SalesListResponse {
  items: Sale[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  nextPage: number | null;
  prevPage: number | null;
  customerPurchaseSummary?: CustomerPurchaseSummary;
}

/** Ventas asociadas a un contacto cliente (coincidencia por nombre o ID fiscal en la venta). */
export const fetchSalesByCustomerContact = async (
  customerContactId: string,
  params?: { page?: number; pageSize?: number }
): Promise<SalesListResponse> => {
  const q = new URLSearchParams();
  q.set("customer_contact_id", customerContactId);
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.pageSize != null) q.set("pageSize", String(params.pageSize));
  return apiFetch<SalesListResponse>(`/api/sales?${q.toString()}`, { method: "GET" });
};

export const createSale = async (payload: CreateSalePayload): Promise<Sale> => {
  return await apiFetch<Sale>("/api/sales", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const fetchSaleById = async (saleId: string): Promise<Sale> => {
  return await apiFetch(`/api/sales/${saleId}`, {
    method: "GET",
  });
};

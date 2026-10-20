/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * API pedidos comerciales.
 */

import { apiFetch } from "./api";
import { remainingQuantity } from '@/lib/commercialQuantity';
import type { QuoteLine, QuoteLinePayload } from "./quoteService";

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "CANCELLED"
  | "EXPIRED";

export type Order = {
  engagementId?:string|null;
  payment_condition?: 'CASH' | 'CREDIT';
  credit_days?: number | null;
  fulfillment_mode?: 'LEGACY' | 'SEPARATE';
  deliveries?: Array<{ id: string; created_at: string; reversed_at?: string | null; notes?: string | null; lines: Array<{ document_line_id: string; qty: number | string; qty_invoiced: number | string;unit_metadata_version?:number;unit_snapshot?:QuoteLine['unit_snapshot'];base_invoiced?:string;unit_label?:string }> }>;
  id: string;
  reference?: string | null;
  branch_id?: string;
  branch?: { id: string; name: string; code: string } | null;
  doc_type: "ORDER";
  status: OrderStatus;
  valid_until?: string | null;
  confirmed_at?: string | null;
  customer?: string | null;
  customer_nit?: string | null;
  is_final_consumer: boolean;
  customer_contact_id?: string | null;
  customerContact?: {
    id: string;
    name: string;
    tax_id?: string | null;
    contact?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  sales_channel: string;
  subtotal?: number | string | null;
  discount_total?: number | string | null;
  total: number | string;
  notes?: string | null;
  delivery_carrier?: string | null;
  delivery_tracking_number?: string | null;
  delivery_address?: string | null;
  delivery_dispatched_at?: string | null;
  delivery_estimated_at?: string | null;
  documentSales?: Array<{
    id: string;
    sale?: {
      id: string;
      reference?: string | null;
      total?: number | string;
      adjusted_total?: number | string;
      payment_status?: "PENDING" | "PARTIAL" | "PAID";
      paymentEntries?: Array<{ amount: number | string }>;
      date?: string;
      status?: { name: string };
    };
  }>;
  convertedFrom?: {
    id: string;
    reference?: string | null;
    doc_type: string;
    status?: string;
  } | null;
  created_by?: string | null;
  createdBy?: { id: string; name: string; email?: string };
  created_at: string;
  updated_at: string;
  lines: Array<QuoteLine & { qty_invoiced?: string | number }>;
  stock_reservations?: Array<{
    id: string;
    product_id: string;
    qty: number;
    status: string;
    expires_at?: string | null;
    reservation_kind?: string;
  }>;
  _count?: { lines: number; stock_reservations?: number; documentSales?: number };
};

export type CreateOrderPayload = {
  payment_condition?: 'CASH' | 'CREDIT';
  credit_days?: number | null;
  /** Sucursal a la que pertenece; por defecto la activa */
  branch_id?: string;
  customer?: string;
  customer_nit?: string;
  is_final_consumer?: boolean;
  customer_contact_id?: string;
  sales_channel?: string;
  notes?: string;
  valid_until?: string;
  items: QuoteLinePayload[];
};

export type OrdersListResponse = {
  items: Order[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  nextPage: number | null;
  prevPage: number | null;
  summary?: Partial<Record<OrderStatus, number>>;
};

export type ConvertOrderToSalePayload = {
  idempotency_key?: string;
  due_date?: string;
  initial_payment?: { amount: number; payment_method_id: number };
  payment_method_id: number;
  amount_received?: number;
  change?: number;
  lines?: Array<{ line_id: string; qty: string | number;presentation_id?:null }>;
  /** Caja seleccionada en el POS; valida el turno contra ella */
  cash_register_id?: string;
};

export type OrderAdminDetailsPayload = {
  payment_condition?: 'CASH' | 'CREDIT';
  credit_days?: number | null;
  delivery_carrier?: string | null;
  delivery_tracking_number?: string | null;
  delivery_address?: string | null;
  delivery_dispatched_at?: string | null;
  delivery_estimated_at?: string | null;
  notes?: string | null;
};

export type PublicOrder = {
  payment_condition?: 'CASH' | 'CREDIT';
  credit_days?: number | null;
  reference?: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  confirmed_at?: string | null;
  valid_until?: string | null;
  customer?: string | null;
  customer_nit?: string | null;
  is_final_consumer: boolean;
  customer_contact?: {
    name?: string | null;
    contact?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  sales_channel?: string | null;
  branch?: { name: string; code: string } | null;
  subtotal?: number | string | null;
  discount_total?: number | string | null;
  total: number | string;
  notes?: string | null;
  company_name: string;
  company_logo_url?: string;
  lines: Array<{
    unit_metadata_version?:1|2;
    unit_snapshot?:import('@/modules/inventory/units/public').UnitSnapshot|null;
    base_qty?:string|null;
    base_fulfilled?:string|null;
    product_name?: string | null;
    item_kind?: 'STANDARD' | 'KIT' | 'SERVICE';
    unit_label?: string | null;
    quantity_decimals?: number;
    barcode?: string | null;
    qty: number | string;
    qty_fulfilled: number | string;
    unit_price: number | string;
    line_total: number | string;
  }>;
  sales: Array<{
    reference?: string | null;
    total?: number | string;
    date?: string | null;
    status?: string | null;
  }>;
};

export function pendingOrderLineQty(line: QuoteLine): number {
  return Number(remainingQuantity(String(line.qty || 0), String(line.qty_fulfilled || 0)));
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  PARTIALLY_FULFILLED: "Parcial",
  FULFILLED: "Completado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
};

export function orderStatusLabel(status: OrderStatus | string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchOrders(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  customerContactId?: string;
  dateFrom?: string;
  dateTo?: string;
  preparationStatus?: string;
  deliveryStatus?: string;
  sort?: "created_desc" | "created_asc" | "total_desc" | "total_asc";
}): Promise<OrdersListResponse> {
  const q = new URLSearchParams();
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.pageSize != null) q.set("pageSize", String(params.pageSize));
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.customerContactId) q.set("customer_contact_id", params.customerContactId);
  if (params?.dateFrom) q.set("date_from", params.dateFrom);
  if (params?.dateTo) q.set("date_to", params.dateTo);
  if (params?.preparationStatus) q.set("preparation_status", params.preparationStatus);
  if (params?.deliveryStatus) q.set("delivery_status", params.deliveryStatus);
  if (params?.sort) q.set("sort", params.sort);
  const qs = q.toString();
  return apiFetch<OrdersListResponse>(`/api/orders${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function fetchOrderById(idOrRef: string): Promise<Order> {
  return apiFetch<Order>(`/api/orders/${encodeURIComponent(idOrRef)}`, { method: "GET" });
}

export async function fetchPublicOrder(token: string): Promise<PublicOrder> {
  const base = import.meta.env.VITE_API_URL ?? "";
  const path = `/orders/public/${encodeURIComponent(token)}`;
  const url = base.endsWith("/") ? `${base.slice(0, -1)}${path}` : `${base}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    let message = "Pedido no disponible";
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // La vista pública presenta un mensaje neutro si el backend no devuelve JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<PublicOrder>;
}

export async function fetchOrderShareLink(id: string): Promise<{ public_token: string; public_url: string }> {
  return apiFetch(`/api/orders/${encodeURIComponent(id)}/share-link`, { method: "GET" });
}

export async function createOrder(payload: CreateOrderPayload,options:RequestInit={}): Promise<Order> {
  return apiFetch<Order>("/api/orders", {
    ...options,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrder(id: string, payload: CreateOrderPayload): Promise<Order> {
  return apiFetch<Order>(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateOrderAdminDetails(id: string, payload: OrderAdminDetailsPayload): Promise<Order> {
  return apiFetch<Order>(`/api/orders/${encodeURIComponent(id)}/admin-details`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Reasigna un pedido en borrador a otra sucursal. Cambia su correlativo. */
export async function changeOrderBranch(id: string, branchId: string): Promise<Order> {
  return apiFetch<Order>(`/api/orders/${encodeURIComponent(id)}/branch`, {
    method: "PUT",
    body: JSON.stringify({ branch_id: branchId }),
  });
}

export async function confirmOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/api/orders/${encodeURIComponent(id)}/confirm`, { method: "POST" });
}

export async function cancelOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export async function convertOrderToSale(
  id: string,
  payload: ConvertOrderToSalePayload,
  options: RequestInit = {}
): Promise<{ order: Order; sale: unknown }> {
  return apiFetch(`/api/orders/${encodeURIComponent(id)}/convert-to-sale`, {
    ...options,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deliverOrder(id: string, payload: { request_key: string; lines: Array<{ line_id: string; qty: string | number;presentation_id?:null }> },options:RequestInit={}) {
  return apiFetch<{ order: Order }>(`/api/orders/${encodeURIComponent(id)}/deliveries`, { ...options,method: 'POST', body: JSON.stringify(payload) });
}

export function reverseOrderDelivery(id: string, deliveryId: string) {
  return apiFetch<{ order: Order }>(`/api/orders/${encodeURIComponent(id)}/deliveries/${encodeURIComponent(deliveryId)}/reverse`, { method: 'POST', body: '{}' });
}

export function invoiceOrder(id: string, payload: ConvertOrderToSalePayload & { request_key: string; due_date?: string },options:RequestInit={}) {
  return apiFetch<{ order: Order; sale: { id: string; reference?: string } }>(`/api/orders/${encodeURIComponent(id)}/invoices`, { ...options,method: 'POST', body: JSON.stringify(payload) });
}

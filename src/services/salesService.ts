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

export interface SalesQueryParams {
  status?: string;
  period?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  payment?: string;
  includeSummary?: boolean;
}

export interface SalesSummary {
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  preferredPaymentMethod: string;
}

export interface SalesListResponse {
  items: unknown[];
  page: number;
  pageSize: number;
  totalPages: number | null;
  totalItems: number | null;
  nextPage: number | null;
  prevPage: number | null;
  hasMore?: boolean;
  summary?: SalesSummary;
  searchMeta?: { tooShort?: boolean; minLength?: number; mode?: string };
}

export const fetchSales = async (params: SalesQueryParams = {}): Promise<SalesListResponse> => {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.period) search.set("period", params.period);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.search?.trim()) search.set("search", params.search.trim());
  if (params.payment?.trim()) search.set("payment", params.payment.trim());
  if (params.includeSummary) search.set("includeSummary", "true");

  const url = `/api/sales${search.toString() ? `?${search.toString()}` : ""}`;
  return apiFetch<SalesListResponse>(url, { method: "GET" });
};

export const updateSaleStatus = async (saleId: string, payload: { status_id?: number; status_name?: string }) => {
  if (!saleId) throw new Error('saleId requerido');
  if (!payload.status_id && !payload.status_name) throw new Error('Debe enviar status_id o status_name');
  return apiFetch(`/api/sales/${saleId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

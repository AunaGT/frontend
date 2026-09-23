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
import type { Branch, Company } from "@/context/AuthContext";
import type { ExperienceProfile } from "@/config/experienceProfiles";

export const fetchCompanies = () => apiFetch<Company[]>("/api/companies", { method: "GET" });

export interface CreateCompanyPayload {
  name: string;
  code: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  branch_name?: string;
  branch_code?: string;
}

export const createCompany = (payload: CreateCompanyPayload) =>
  apiFetch<Company>("/api/companies", { method: "POST", body: JSON.stringify(payload) });

export const updateCompany = (id: string, payload: Partial<CreateCompanyPayload> & { active?: boolean }) =>
  apiFetch<Company>(`/api/companies/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

/** ?all=1 lista todas las sucursales de la empresa (requiere permiso). */
export const fetchBranches = (all = false) =>
  apiFetch<Branch[]>(`/api/branches${all ? "?all=1" : ""}`, { method: "GET" });

export interface CreateBranchPayload {
  name: string;
  /** Se genera del nombre si no se manda. */
  code?: string;
  address?: string;
  phone?: string;
}

export const createBranch = (payload: CreateBranchPayload) =>
  apiFetch<Branch>("/api/branches", { method: "POST", body: JSON.stringify(payload) });

export const updateBranch = (
  id: string,
  payload: Partial<CreateBranchPayload> & { active?: boolean; is_default?: boolean }
) =>
  apiFetch<Branch>(`/api/branches/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const fetchUserBranches = (userId: string) =>
  apiFetch<{ branches: Branch[]; default_branch_id: string | null }>(
    `/api/branches/user/${encodeURIComponent(userId)}`,
    { method: "GET" }
  );

export const assignUserBranches = (payload: {
  user_id: string;
  branch_ids: string[];
  default_branch_id?: string | null;
}) => apiFetch<{ ok: boolean }>("/api/branches/assign", { method: "PUT", body: JSON.stringify(payload) });

export const addUserToCompany = (companyId: string, userId: string) =>
  apiFetch<{ ok: boolean }>(
    `/api/companies/${encodeURIComponent(companyId)}/users/${encodeURIComponent(userId)}`,
    { method: "POST" }
  );

export const removeUserFromCompany = (companyId: string, userId: string) =>
  apiFetch<{ ok: boolean }>(
    `/api/companies/${encodeURIComponent(companyId)}/users/${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );

export const updateUserExperienceProfile = (
  companyId: string,
  userId: string,
  experienceProfile: ExperienceProfile | null
) =>
  apiFetch<{ experience_profile: ExperienceProfile | null }>(
    `/api/companies/${encodeURIComponent(companyId)}/users/${encodeURIComponent(userId)}/experience-profile`,
    {
      method: "PATCH",
      body: JSON.stringify({ experience_profile: experienceProfile }),
    }
  );

// ---------- Traslados entre sucursales ----------

export type TransferStatus = "EN_TRANSITO" | "RECIBIDA" | "CANCELADA";

export interface TransferLine {
  id: string;
  product_id: string;
  qty_sent: number;
  qty_received: number | null;
  product?: { id: string; name: string; barcode?: string | null; image_url?: string | null };
}

export interface Transfer {
  id: string;
  reference: string;
  status: TransferStatus;
  from_branch_id: string;
  to_branch_id: string;
  sent_at: string;
  received_at?: string | null;
  notes?: string | null;
  fromBranch?: { id: string; name: string; code: string };
  toBranch?: { id: string; name: string; code: string };
  createdBy?: { id: string; name: string };
  receivedBy?: { id: string; name: string } | null;
  lines: TransferLine[];
}

export interface TransfersResponse {
  items: Transfer[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export const fetchTransfers = (params?: {
  direction?: "in" | "out" | "all";
  status?: TransferStatus;
  search?: string;
  fromBranchId?: string;
  toBranchId?: string;
  page?: number;
  pageSize?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.direction) q.set("direction", params.direction);
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.fromBranchId) q.set("from_branch_id", params.fromBranchId);
  if (params?.toBranchId) q.set("to_branch_id", params.toBranchId);
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return apiFetch<TransfersResponse>(`/api/transfers${qs ? `?${qs}` : ""}`, { method: "GET" });
};

export const fetchTransfer = (id: string) =>
  apiFetch<Transfer>(`/api/transfers/${encodeURIComponent(id)}`, { method: "GET" });

export const createTransfer = (payload: {
  to_branch_id: string;
  items: { product_id: string; qty: number }[];
  notes?: string;
}) => apiFetch<Transfer>("/api/transfers", { method: "POST", body: JSON.stringify(payload) });

export const receiveTransfer = (
  id: string,
  lines?: { line_id: string; qty_received: number }[],
  /** Ubicación donde entra la mercancía; sin ella, la de recepción por defecto. */
  toLocationId?: string
) =>
  apiFetch<Transfer>(`/api/transfers/${encodeURIComponent(id)}/receive`, {
    method: "POST",
    body: JSON.stringify({
      ...(lines ? { lines } : {}),
      ...(toLocationId ? { to_location_id: toLocationId } : {}),
    }),
  });

export const cancelTransfer = (id: string) =>
  apiFetch<Transfer>(`/api/transfers/${encodeURIComponent(id)}/cancel`, { method: "POST" });

export interface InTransitReport {
  products: {
    product_id: string;
    name: string;
    barcode: string | null;
    qty: number;
    transfers: {
      transfer_id: string;
      reference: string;
      from: string;
      to: string;
      sent_at: string;
      qty: number;
    }[];
  }[];
  totalTransfers: number;
}

export const fetchInTransit = () =>
  apiFetch<InTransitReport>("/api/transfers/in-transit", { method: "GET" });

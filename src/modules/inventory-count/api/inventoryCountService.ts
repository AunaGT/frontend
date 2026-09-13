/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * API inventariado (sesiones de conteo físico).
 */

import { apiFetch, downloadFile } from "@/services/api";

export type InventoryCountSessionStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "PENDING_SECOND_APPROVAL"
  | "APPROVED"
  | "CANCELLED";

export type InventoryCountScope = {
  categoryIds?: number[];
  supplierIds?: string[];
  /** Clases ABC por valor en bodega (Pareto acumulado 80/15/5 %) */
  abcClasses?: ("A" | "B" | "C")[];
  /** 1–99: subconjunto aleatorio reproducible del alcance */
  samplePercent?: number;
  /** Segunda lectura obligatoria; debe coincidir con la primera para enviar */
  doubleCount?: boolean;
};

export type InventoryCountSessionSummary = {
  id: string;
  name: string | null;
  status: InventoryCountSessionStatus;
  scope_json: InventoryCountScope | null;
  dual_approval: boolean;
  submit_reason: string | null;
  first_approved_at: string | null;
  first_approval_reason: string | null;
  final_approval_reason: string | null;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  createdBy: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string; email: string } | null;
  firstApprovedBy?: { id: string; name: string; email: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
  _count?: { lines: number };
  progress?: { totalLines: number; countedLines: number; pct: number };
  totals?: { sumStockSnapshot: number; valueDeltaApprox: number };
};

export type InventoryCountLineRow = {
  id: string;
  session_id: string;
  product_id: string;
  stock_snapshot: number;
  qty_counted: number | null;
  qty_counted_secondary: number | null;
  counted_at: string | null;
  counted_secondary_at: string | null;
  counted_by_id: string | null;
  counted_secondary_by_id: string | null;
  note: string | null;
  product: {
    id: string;
    name: string;
    barcode: string | null;
    stock: number;
    cost: string | number;
    category: { id: number; name: string };
  };
  location: {
    id: string;
    code: string;
    name: string | null;
    warehouse: { id: string; name: string; code: string };
  };
  countedBy?: { id: string; name: string } | null;
  countedSecondaryBy?: { id: string; name: string } | null;
  difference: number | null;
  valueDifference: number | null;
  countMismatch?: boolean;
};

const path = (p: string) => `/inventory-counts${p}`;

export async function listInventorySessions(params?: {
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<{ data: InventoryCountSessionSummary[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.offset != null) sp.set("offset", String(params.offset));
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const q = sp.toString();
  return apiFetch(q ? `${path("")}?${q}` : path(""));
}

export async function getInventorySession(id: string): Promise<InventoryCountSessionSummary> {
  return apiFetch(path(`/${id}`));
}

export async function createInventorySession(body: {
  name?: string;
  /** Acota el conteo a un almacén de la sucursal; sin él, cuenta toda la sucursal. */
  warehouse_id?: string;
  scope?: InventoryCountScope;
  notes?: string;
  dual_approval?: boolean;
}): Promise<InventoryCountSessionSummary> {
  return apiFetch(path(""), { method: "POST", body: JSON.stringify(body) });
}

export async function startInventorySession(id: string): Promise<InventoryCountSessionSummary> {
  return apiFetch(path(`/${id}/start`), { method: "POST", body: JSON.stringify({}) });
}

export async function listInventorySessionLines(
  sessionId: string,
  opts?: { q?: string; offset?: number; limit?: number; pendingOnly?: boolean; locationId?: string }
): Promise<{ data: InventoryCountLineRow[]; total: number }> {
  const sp = new URLSearchParams();
  if (opts?.q) sp.set("q", opts.q);
  if (opts?.offset != null) sp.set("offset", String(opts.offset));
  if (opts?.limit != null) sp.set("limit", String(opts.limit));
  if (opts?.pendingOnly) sp.set("pending", "1");
  if (opts?.locationId) sp.set("location_id", opts.locationId);
  const q = sp.toString();
  return apiFetch(q ? `${path(`/${sessionId}/lines`)}?${q}` : path(`/${sessionId}/lines`));
}

export async function updateInventoryLine(
  sessionId: string,
  lineId: string,
  body: { qty_counted?: number; qty_counted_secondary?: number; note?: string }
): Promise<InventoryCountLineRow> {
  return apiFetch(path(`/${sessionId}/lines/${lineId}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function submitInventorySession(
  id: string,
  body: { reason: string }
): Promise<InventoryCountSessionSummary> {
  return apiFetch(path(`/${id}/submit`), { method: "POST", body: JSON.stringify(body) });
}

export async function approveInventorySession(
  id: string,
  body: { reason: string }
): Promise<InventoryCountSessionSummary> {
  return apiFetch(path(`/${id}/approve`), { method: "POST", body: JSON.stringify(body) });
}

export async function cancelInventorySession(
  id: string,
  reason: string
): Promise<InventoryCountSessionSummary> {
  return apiFetch(path(`/${id}/cancel`), {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** Descarga PDF o CSV del reporte de la sesión (requiere token). */
export async function downloadInventorySessionReport(
  sessionId: string,
  format: "pdf" | "csv"
): Promise<void> {
  await downloadFile(
    `/reports/inventory-count-session/${sessionId}?format=${format}`,
    `inventariado-${sessionId.slice(0, 8)}.${format}`
  );
}

export function statusLabel(s: InventoryCountSessionStatus): string {
  const map: Record<InventoryCountSessionStatus, string> = {
    DRAFT: "Pendiente de empezar",
    IN_PROGRESS: "Contando",
    IN_REVIEW: "En revisión",
    PENDING_SECOND_APPROVAL: "Falta segunda firma",
    APPROVED: "Cerrado y guardado",
    CANCELLED: "Cancelado",
  };
  return map[s] || s;
}

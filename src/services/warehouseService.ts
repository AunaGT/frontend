/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Almacenes y ubicaciones de la SUCURSAL ACTIVA. La sucursal va en las cabeceras
 * que agrega apiFetch, así que aquí no se pasa nunca.
 */
import { apiFetch } from "./api";

export type WarehouseKind = "BODEGA" | "SALA_VENTAS" | "VITRINA" | "TRANSITO" | "OTRO";

export const WAREHOUSE_KIND_LABELS: Record<WarehouseKind, string> = {
  BODEGA: "Bodega",
  SALA_VENTAS: "Sala de ventas",
  VITRINA: "Vitrina",
  TRANSITO: "Tránsito",
  OTRO: "Otro",
};

export interface StockLocation {
  id: string;
  warehouse_id: string;
  code: string;
  name: string | null;
  is_default: boolean;
  pickable: boolean;
  dispatch_priority: number;
  active: boolean;
  /** Es la ubicación desde la que despacha el punto de venta de la sucursal. */
  is_sales?: boolean;
}

export interface Warehouse {
  id: string;
  branch_id: string;
  /** Viene en el listado: sirve para etiquetar "Sucursal · Almacén". */
  branch?: { id: string; name: string; active?: boolean };
  name: string;
  code: string;
  kind: WarehouseKind;
  is_default: boolean;
  is_receiving: boolean;
  dispatch_priority: number;
  active: boolean;
  notes: string | null;
  stock_units?: number;
  locations: StockLocation[];
}

export interface WarehousePayload {
  name: string;
  /** Se genera del nombre si no se manda. */
  code?: string;
  kind?: WarehouseKind;
  dispatch_priority?: number;
  is_default?: boolean;
  is_receiving?: boolean;
  notes?: string;
}

export interface LocationPayload {
  /** Se genera del nombre si no se manda. */
  code?: string;
  name: string;
  pickable?: boolean;
  dispatch_priority?: number;
  is_default?: boolean;
}

/** `branchId` acota a otra sucursal sin cambiar el selector global; 'all' = todas las visibles. */
export const fetchWarehouses = (branchId?: string) =>
  apiFetch<Warehouse[]>(
    `/api/warehouses${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ""}`,
    { method: "GET" }
  );

export const createWarehouse = (payload: WarehousePayload) =>
  apiFetch<Warehouse>("/api/warehouses", { method: "POST", body: JSON.stringify(payload) });

export const updateWarehouse = (id: string, payload: Partial<WarehousePayload> & { active?: boolean }) =>
  apiFetch<Warehouse>(`/api/warehouses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteWarehouse = (id: string) =>
  apiFetch<{ ok: true }>(`/api/warehouses/${encodeURIComponent(id)}`, { method: "DELETE" });

export const createLocation = (warehouseId: string, payload: LocationPayload) =>
  apiFetch<StockLocation>(`/api/warehouses/${encodeURIComponent(warehouseId)}/locations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateLocation = (id: string, payload: Partial<LocationPayload> & { active?: boolean }) =>
  apiFetch<StockLocation>(`/api/warehouses/locations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

/** Alterna la ubicación de venta de la sucursal: marcarla otra vez la quita. */
export const setSalesLocation = (id: string) =>
  apiFetch<{ sales_location_id: string | null }>(
    `/api/warehouses/locations/${encodeURIComponent(id)}/sales`,
    { method: "PUT" }
  );

export const deleteLocation = (id: string) =>
  apiFetch<{ ok: true }>(`/api/warehouses/locations/${encodeURIComponent(id)}`, { method: "DELETE" });

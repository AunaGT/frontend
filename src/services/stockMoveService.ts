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
 * Movimientos de existencias de la sucursal activa: internos entre ubicaciones,
 * ajustes contra una ubicación, y la lectura del libro (que filtrado por
 * producto es el kardex).
 */
import { apiFetch } from "./api";

export type StockMovementReason =
  | "INITIAL" | "PURCHASE" | "SALE" | "SALE_RETURN" | "ORDER_FULFILL"
  | "TRANSFER_OUT" | "TRANSFER_IN" | "TRANSFER_CANCEL" | "INTERNAL_MOVE"
  | "COUNT_ADJUST" | "MANUAL_ADJUST" | "KIT_ASSEMBLE" | "KIT_DISASSEMBLE";

export const REASON_LABELS: Record<StockMovementReason, string> = {
  INITIAL: "Saldo inicial",
  PURCHASE: "Ingreso de mercancía",
  SALE: "Venta",
  SALE_RETURN: "Devolución",
  ORDER_FULFILL: "Entrega de pedido",
  TRANSFER_OUT: "Traslado enviado",
  TRANSFER_IN: "Traslado recibido",
  TRANSFER_CANCEL: "Traslado cancelado",
  INTERNAL_MOVE: "Movimiento interno",
  COUNT_ADJUST: "Ajuste por conteo",
  MANUAL_ADJUST: "Ajuste manual",
  KIT_ASSEMBLE: "Kit armado",
  KIT_DISASSEMBLE: "Kit desarmado",
};

export interface StockMovement {
  id: string;
  qty: number;
  balance: number;
  reason: StockMovementReason;
  ref_type: string | null;
  group_id: string | null;
  notes: string | null;
  created_at: string;
  product: { id: string; name: string; barcode: string | null };
  location: {
    id: string;
    code: string;
    name: string | null;
    warehouse: { id: string; name: string; code: string };
  };
  createdBy: { id: string; name: string } | null;
}

export interface MovementFilters {
  product_id?: string;
  location_id?: string;
  group_id?: string;
  reason?: StockMovementReason;
  from?: string;
  to?: string;
  limit?: number;
}

export const fetchMovements = (filters: MovementFilters = {}) => {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])
  ).toString();
  return apiFetch<StockMovement[]>(`/api/stock/moves${qs ? `?${qs}` : ""}`, { method: "GET" });
};

export interface MoveLine {
  product_id: string;
  qty: number;
  lot_code?: string;
  expiry_date?: string;
}

export const createStockMove = (payload: {
  from_location_id: string;
  to_location_id: string;
  lines: MoveLine[];
  notes?: string;
}) =>
  apiFetch<{ group_id: string; movements: StockMovement[] }>("/api/stock/moves", {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** qty con signo: negativo es merma, positivo es sobrante encontrado. */
export const createAdjustment = (payload: {
  location_id: string;
  lines: MoveLine[];
  notes?: string;
}) =>
  apiFetch<{ products: unknown[] }>("/api/stock/adjustments", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export interface LocationStock {
  stock: number;
  min_stock: number;
  location: {
    id: string;
    code: string;
    name: string | null;
    pickable: boolean;
    active: boolean;
    warehouse: {
      id: string;
      name: string;
      code: string;
      dispatch_priority: number;
      /** Solo en vista consolidada: de qué sucursal es el almacén. */
      branch?: { id: string; name: string };
    };
  };
}

export const fetchStockByLocation = (productId: string) =>
  apiFetch<LocationStock[]>(`/api/stock/by-location?product_id=${encodeURIComponent(productId)}`, {
    method: "GET",
  });

/** Mínimo interno del anaquel: dispara mover, no comprar. */
export const setLocationMin = (payload: {
  product_id: string;
  location_id: string;
  min_stock: number;
}) =>
  apiFetch<LocationStock>("/api/stock/by-location/min", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export interface ReplenishmentRow {
  product_id: string;
  product_name: string;
  barcode: string | null;
  location_id: string;
  location_code: string;
  location_name: string | null;
  warehouse_name: string;
  stock: number;
  min_stock: number;
  missing: number;
  from_location_id: string | null;
  from_location_code: string | null;
  from_warehouse_name: string | null;
  from_stock: number | null;
  suggested_qty: number;
}

export const fetchReplenishment = () =>
  apiFetch<ReplenishmentRow[]>("/api/stock/replenishment", { method: "GET" });

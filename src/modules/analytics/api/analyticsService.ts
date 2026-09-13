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

export type AnalyticsResponse = {
  year: number;
  /** Año calendario (zona GT) de la venta completada más antigua; si no hay ventas, año actual. */
  firstSaleYear: number;
  totals: {
    totalSales: number; // Ventas netas (con devoluciones restadas)
    totalSalesGross?: number; // Ventas brutas (sin restar devoluciones)
    totalReturns?: number; // Total devuelto
    totalCost: number;
    totalProfit: number;
    productsCount: number;
    stockRotation: number;
  };
  monthly: {
    month: number;
    ventas: number;
    costo: number;
    devoluciones?: number;
    ventasNetas?: number;
  }[];
  topProducts: { id: string; name: string; category: string; ventas: number; revenue: number }[];
  categoryPerformance: { category: string; revenue: number; cost: number; profit: number; margin: number; percentage: number }[];
  paymentMethods: { method: string; total: number; count: number }[];
  channels: { channel: string; label: string; total: number; count: number }[];
  inventory: {
    stockValue: number;
    retailValue: number;
    potentialProfit: number;
    lowStockCount: number;
    outOfStockCount: number;
    productsCount: number;
    byCategory: { category: string; value: number; units: number }[];
  };
  purchases: {
    total: number;
    payableCount: number;
    payablePending: number;
    monthly: { month: number; amount: number }[];
    topSuppliers: { name: string; amount: number }[];
  };
  initialInventory: {
    total: number;
    units: number;
    count: number;
  };
}

export async function getAnalytics(year: number | 'all'): Promise<AnalyticsResponse> {
  return apiFetch<AnalyticsResponse>(`/analytics/summary?year=${year}`)
}

export async function getAnalyticsFirstSaleYear(): Promise<{ firstSaleYear: number }> {
  return apiFetch<{ firstSaleYear: number }>(`/analytics/first-sale-year`)
}

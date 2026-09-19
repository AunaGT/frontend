/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/api';
import { useTenant } from '@/context/useTenant';

export interface DashboardStats {
  ventasHoy: {
    valor: number;
    cantidad: number;
    cambio: number | null;
    comparacion: string;
  };
  productosEnStock: {
    cantidad: number | null;
    cambio: number;
    comparacion: string;
  };
  valorInventario: {
    valor: number | null;
    cambio: number;
    comparacion: string;
  };
  alertasCriticas: {
    cantidad: number | null;
    cambio: number;
    comparacion: string;
  };
  periods: Record<'today' | 'week' | 'month', {
    sales: number;
    estimatedGrossProfit: number;
    transactions: number;
    averageTicket: number;
    salesChange: number | null;
    profitChange: number | null;
    previousSales: number;
  }>;
  pendingCashDifferences: { count: number; amount: number } | null;
  timestamp: string;
  timezone: string;
}

const useDashboardStats = (enabled = true) => {
  const { company, branch, isConsolidated } = useTenant();
  return useQuery<DashboardStats>({
    queryKey: ['dashboardStats', company?.id, isConsolidated ? 'all' : branch?.id],
    queryFn: async () => {
      const data = await apiFetch('/api/dashboard/stats', {
        method: 'GET',
      });
      return data as DashboardStats;
    },
    enabled,
    refetchInterval: 320000, // Refrescar cada 5 minutos
    staleTime: 30000, // Considerar los datos obsoletos después de 30 segundos
  });
};

export default useDashboardStats;

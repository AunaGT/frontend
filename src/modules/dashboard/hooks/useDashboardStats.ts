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

export interface DashboardStats {
  ventasHoy: {
    valor: number;
    cantidad: number;
    cambio: number;
    comparacion: string;
  };
  productosEnStock: {
    cantidad: number;
    cambio: number;
    comparacion: string;
  };
  valorInventario: {
    valor: number;
    cambio: number;
    comparacion: string;
  };
  alertasCriticas: {
    cantidad: number;
    cambio: number;
    comparacion: string;
  };
  timestamp: string;
  timezone: string;
}

const useDashboardStats = () => {
  return useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const data = await apiFetch('/api/dashboard/stats', {
        method: 'GET',
      });
      console.log(data)
      return data as DashboardStats;
    },
    refetchInterval: 320000, // Refrescar cada 5 minutos
    staleTime: 30000, // Considerar los datos obsoletos después de 30 segundos
  });
};

export default useDashboardStats;

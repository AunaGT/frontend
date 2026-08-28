/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery } from '@tanstack/react-query'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { fetchOverdueCount } from '@/services/receivablesService'

/**
 * Facturas al crédito vencidas, para el indicador de la barra superior.
 *
 * No sale de la tabla `alerts` a propósito: ese modelo es de stock
 * (`product_id` es obligatorio), así que una factura no cabe ahí sin volverla
 * polimórfica. Ver GET /api/receivables/overdue-count.
 */
export const OVERDUE_RECEIVABLES_QUERY_KEY = ['receivables', 'overdue-count'] as const

export const useOverdueReceivablesCount = () => {
  const { hasPermission } = useAuthPermissions()
  return useQuery({
    queryKey: OVERDUE_RECEIVABLES_QUERY_KEY,
    queryFn: fetchOverdueCount,
    enabled: hasPermission('receivables.view'),
    staleTime: 5 * 60 * 1000,
  })
}

export default useOverdueReceivablesCount

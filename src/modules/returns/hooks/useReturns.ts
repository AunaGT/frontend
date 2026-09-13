/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import {
  fetchReturns,
  fetchReturnById,
  createReturn,
  updateReturnStatus,
  Return,
  ReturnListResponse,
  CreateReturnPayload,
  UpdateReturnStatusPayload
} from '../api/returnService'

/**
 * Hook to fetch returns with optional filters
 */
export const useReturns = (params?: {
  status?: string
  sale_id?: string
  page?: number
  pageSize?: number
}): UseQueryResult<ReturnListResponse, Error> => {
  return useQuery({
    queryKey: ['returns', params],
    queryFn: () => fetchReturns(params),
    staleTime: 30000 // 30 seconds
  })
}

/**
 * Hook to fetch a specific return by ID
 */
export const useReturnById = (id: string): UseQueryResult<Return, Error> => {
  return useQuery({
    queryKey: ['returns', id],
    queryFn: () => fetchReturnById(id),
    enabled: !!id,
    staleTime: 60000 // 1 minute
  })
}

/**
 * Hook to create a new return
 */
export const useCreateReturn = (): UseMutationResult<Return, Error, CreateReturnPayload> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createReturn,
    onSuccess: () => {
      // Invalidate returns list to refetch with new return
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      // Also invalidate sales since return affects the sale
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      // Invalidate products since stock may have changed
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

/**
 * Hook to update return status
 */
export const useUpdateReturnStatus = (): UseMutationResult<
  Return,
  Error,
  { id: string; payload: UpdateReturnStatusPayload }
> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateReturnStatus(id, payload),
    onSuccess: (data) => {
      // Invalidate returns list
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      // Invalidate specific return
      queryClient.invalidateQueries({ queryKey: ['returns', data.id] })
      // Invalidate products if stock was adjusted
      if (data._stockAdjustment === 'stock_restored') {
        queryClient.invalidateQueries({ queryKey: ['products'] })
      }
    }
  })
}

/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchIncomingMerchandise,
  getIncomingMerchandiseById,
  patchIncomingMerchandisePayment,
  postIncomingMerchandisePayment,
  deleteIncomingMerchandisePayment,
  type IncomingMerchandiseQueryParams,
  type PatchIncomingMerchandisePaymentPayload,
  type PostIncomingMerchandisePaymentBody,
} from '../api/incomingMerchandiseService'

export const useIncomingMerchandise = (params?: IncomingMerchandiseQueryParams) => {
  const { enabled = true, ...fetchParams } = params ?? {}
  return useQuery({
    queryKey: ['incoming-merchandise', fetchParams],
    queryFn: () => fetchIncomingMerchandise(fetchParams),
    staleTime: 30 * 1000, // 30 seconds
    enabled,
  })
}

export const useIncomingMerchandiseById = (id?: string) => {
  return useQuery({
    queryKey: ['incoming-merchandise', id],
    queryFn: () => getIncomingMerchandiseById(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export const usePatchIncomingMerchandisePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PatchIncomingMerchandisePaymentPayload }) =>
      patchIncomingMerchandisePayment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-merchandise'] })
    },
  })
}

export const usePostIncomingMerchandisePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PostIncomingMerchandisePaymentBody }) =>
      postIncomingMerchandisePayment(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-merchandise'] })
    },
  })
}

export const useDeleteIncomingMerchandisePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entryId }: { id: string; entryId: string }) =>
      deleteIncomingMerchandisePayment(id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-merchandise'] })
    },
  })
}

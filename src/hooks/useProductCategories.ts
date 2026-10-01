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
import { apiFetch } from '../services/api'

export interface ProductCategory {
  id: number
  name: string
  image_url?: string | null
  deleted: boolean
  _count?: {
    products: number
    suppliers: number
  }
}

export interface ProductCategoriesQueryParams {
  page?: number
  pageSize?: number
  includeDeleted?: boolean
  search?: string
  order?: 'asc' | 'desc'
}

export interface ProductCategoriesResponse {
  items: ProductCategory[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  nextPage: number | null
  prevPage: number | null
}

// Obtener categorías con paginación
export function useProductCategories(params?: ProductCategoriesQueryParams) {
  const { page = 1, pageSize = 10, includeDeleted = false, search: query = '', order = 'asc' } = params || {}
  
  return useQuery<ProductCategoriesResponse>({
    queryKey: ['productCategories', page, pageSize, includeDeleted, query, order],
    queryFn: async () => {
      const search = new URLSearchParams()
      if (page) search.set('page', String(page))
      if (pageSize) search.set('pageSize', String(pageSize))
      if (includeDeleted) search.set('includeDeleted', 'true')
      if (query.trim()) search.set('search', query.trim())
      search.set('order', order)
      
      const url = `/catalogs/product-categories${search.toString() ? `?${search.toString()}` : ''}`
      return apiFetch<ProductCategoriesResponse>(url)
    },
  })
}

export interface ProductCategoryPayload {
  name: string
  image_url?: string | null
}

// Crear categoría
export function useCreateProductCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: ProductCategoryPayload) => {
      return apiFetch<ProductCategory>('/catalogs/product-categories', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productCategories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] }) // Para useCategories
    },
  })
}

// Actualizar categoría
export function useUpdateProductCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductCategoryPayload }) => {
      return apiFetch<ProductCategory>(`/catalogs/product-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productCategories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

// Eliminar categoría (soft delete)
export function useDeleteProductCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      return apiFetch(`/catalogs/product-categories/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productCategories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

// Restaurar categoría
export function useRestoreProductCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      return apiFetch(`/catalogs/product-categories/${id}/restore`, { method: 'PATCH' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productCategories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

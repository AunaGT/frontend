/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

// filepath: /home/DiegoPatzan/Documents/CODE/deposito/guate-liquor-vault-13/src/hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProducts, fetchAllProducts, type ProductsQueryParams, type ProductsResponse } from "@/services/productService";
import { apiFetch } from "@/services/api";
import type { Product } from "@/types";

export const PRODUCTS_QUERY_KEY = ["products"] as const;

export const useProducts = (params?: ProductsQueryParams) => {
  return useQuery<ProductsResponse, Error>({
    queryKey: [...PRODUCTS_QUERY_KEY, params],
    queryFn: () => fetchProducts(params),
    // Sin staleTime: al volver al listado (o al cambiar el filtro de sucursal) se
    // re-consulta. Con caché de 1 min, un producto recién agregado a la sucursal
    // desde su ficha solo aparecía recargando la página.
    staleTime: 0,
  });
};

/** Catálogo completo en memoria (p. ej. POS). Con `forSaleOnly`, excluye productos marcados solo para inventario. */
export const useAllProducts = (options?: Pick<ProductsQueryParams, 'forSaleOnly' | 'inBranchOnly' | 'catalogType'>) => {
  const forSaleOnly = options?.forSaleOnly === true;
  const inBranchOnly = options?.inBranchOnly === true;
  const catalogType = options?.catalogType ?? 'goods';
  return useQuery<Product[], Error>({
    queryKey: [...PRODUCTS_QUERY_KEY, "all", forSaleOnly, inBranchOnly, catalogType],
    queryFn: async () => fetchAllProducts({ forSaleOnly, inBranchOnly, catalogType }),
    staleTime: 60 * 1000, // 1 min
  });
};

export const useDeletedProducts = (options?: ProductsQueryParams & { enabled?: boolean }) => {
  const { enabled = true, ...params } = options ?? {};
  return useQuery<ProductsResponse, Error>({
    queryKey: [...PRODUCTS_QUERY_KEY, "deleted", params],
    queryFn: () => fetchProducts({ ...params, deletedOnly: true }),
    staleTime: 30 * 1000,
    enabled,
  });
};

export const useRestoreProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/products/${id}/restore`, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["products", "deleted"] });
    },
  });
};

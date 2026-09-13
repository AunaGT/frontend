/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery } from "@tanstack/react-query";
import { fetchCriticalProducts } from "@/services/productService";

export const CRITICAL_PRODUCTS_QUERY_KEY = ["products", "critical"] as const;

export const useCriticalProducts = () => {
  return useQuery({
    queryKey: CRITICAL_PRODUCTS_QUERY_KEY,
    queryFn: fetchCriticalProducts,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export default useCriticalProducts;

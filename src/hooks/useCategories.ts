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
import { fetchCategories, type CategoriesQueryOptions } from "@/services/catalogService";

export const CATEGORIES_QUERY_KEY = ["categories"] as const;

export const useCategories = (options?: CategoriesQueryOptions) => {
  return useQuery({
    queryKey: options ? [...CATEGORIES_QUERY_KEY, options] : CATEGORIES_QUERY_KEY,
    queryFn: () => fetchCategories(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

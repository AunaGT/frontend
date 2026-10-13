/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { apiFetch } from "./api";

export interface ApiCategory {
  id: number | string;
  name: string;
  image_url?: string | null;
}

export interface CategoriesQueryOptions {
  includeDeleted?: boolean;
  allPages?: boolean;
}

export const fetchCategories = async (options: CategoriesQueryOptions = {}): Promise<ApiCategory[]> => {
  const categories: ApiCategory[] = [];
  let page = 1;
  while (true) {
    const query = new URLSearchParams({ page: String(page), pageSize: options.allPages ? '100' : '1000' });
    if (options.includeDeleted) query.set('includeDeleted', 'true');
    const data = await apiFetch<ApiCategory[] | { items: ApiCategory[]; nextPage?: number | null }>(`/api/catalogs/product-categories?${query}`, { method: "GET" });
    if (Array.isArray(data)) return categories.concat(data);
    if (!data || !Array.isArray(data.items)) return categories;
    categories.push(...data.items);
    if (!options.allPages || !data.nextPage || data.nextPage <= page) return categories;
    page = data.nextPage;
  }
};

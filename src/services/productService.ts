/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { apiFetch, downloadFile, getApiBaseUrl } from "./api";
import type { Product, StockStatus } from "@/types";
import type { ApiProduct as ApiProductType, CreateProductPayload as CreateProductPayloadType, UpdateProductPayload as UpdateProductPayloadType } from "@/types/product";

// API product shape (flexible; fields optional to adapt to various backends)
export type ApiProduct = ApiProductType;

const normalizeStatusName = (name: string): StockStatus | string => {
  const n = name.trim().toLowerCase();
  if (["disponible", "activo", "available", "active"].includes(n)) return "active";
  if (["bajo", "stock bajo", "low", "low_stock"].includes(n)) return "low_stock";
  if (["critico", "crítico", "critical"].includes(n)) return "critical";
  if (["agotado", "sin stock", "no disponible", "out_of_stock", "out of stock"].includes(n)) return "out_of_stock";
  return name; // fallback to original string
};

const mapStatus = (status?: string | number): StockStatus | string => {
  if (typeof status === "string") return normalizeStatusName(status);
  if (typeof status === "number") {
    switch (status) {
      case 1:
        return "active";
      case 2:
        return "low_stock";
      case 3:
        return "out_of_stock";
      default:
        return "active";
    }
  }
  return "active";
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

export const adaptApiProduct = (p: ApiProduct): Product => {
  const category =
    (typeof p.category === "object" && p.category?.name)
      ? p.category.name
      : (typeof p.category === "string" ? p.category : undefined) ||
      p.category_name ||
      (p.category_id != null ? String(p.category_id) : "");

  const supplier =
    (typeof p.supplier === "object" && p.supplier?.name)
      ? p.supplier.name
      : (typeof p.supplier === "string" ? p.supplier : undefined) ||
      p.supplier_name ||
      (p.supplier_id != null ? String(p.supplier_id) : "");

  const statusRaw: string | number | undefined =
    (typeof p.status === "object" && (p.status as { id?: string | number; name?: string }).name)
      ? (p.status as { id?: string | number; name?: string }).name!
      : (typeof p.status === "string" ? p.status : undefined) ??
      (typeof p.status_id !== "undefined" ? Number(p.status_id) : undefined);

  const status = mapStatus(statusRaw);

  // Extraer supplier_id si está disponible (para uso interno)
  const supplierId = 
    (typeof p.supplier === "object" && (p.supplier as { id?: string | number }).id)
      ? String((p.supplier as { id: string | number }).id)
      : (p.supplier_id != null ? String(p.supplier_id) : undefined);

  return {
    id: String(p.id),
    name: p.name,
    category: category || "Sin categoría",
    brand: p.brand || "",
    size: p.size || "",
    stock: toNumber(p.stock, 0),
    minStock: toNumber(p.min_stock, 0),
    price: toNumber(p.price, 0),
    priceWholesale:
      p.price_wholesale != null && p.price_wholesale !== ''
        ? toNumber(p.price_wholesale, 0)
        : null,
    pricePromotion:
      p.price_promotion != null && p.price_promotion !== ''
        ? toNumber(p.price_promotion, 0)
        : null,
    promotionValidUntil:
      (p.promotion_valid_until as string | null | undefined) != null &&
      String(p.promotion_valid_until).trim() !== ''
        ? String(p.promotion_valid_until)
        : null,
    cost: toNumber(p.cost, 0),
    supplier: supplier || "",
    supplierId: supplierId, // Agregar supplierId para uso interno
    barcode: p.barcode || "",
    description: (p.description ?? "") as string,
    imageUrl: (p.image_url ?? undefined) as string | undefined,
    status,
    deleted: p.deleted === true || p.deleted === 1 || (p as { deleted?: boolean }).deleted === true,
    deleted_at: (p as { deleted_at?: string | null }).deleted_at || null,
    availableForSale: (p as { available_for_sale?: boolean }).available_for_sale !== false,
    tracksExpiry: (p as { tracks_expiry?: boolean }).tracks_expiry === true,
    kind: (p.kind === "KIT" ? "KIT" : "STANDARD") as import("@/types/product").ProductKind,
    inBranch: (p as { in_branch?: boolean }).in_branch !== false,
    stockAssembled: p.stock_assembled === true,
    kitComponents: Array.isArray(p.kit_components) ? p.kit_components : undefined,
  };
};

export interface ProductsQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  supplier?: string;
  includeDeleted?: boolean;
  /** Solo productos disponibles para venta (POS). */
  forSaleOnly?: boolean;
  /** Solo los productos que maneja la sucursal del alcance (los demás ni aparecen). */
  inBranchOnly?: boolean;
  /** Alcance de la pantalla: manda sobre el selector global. 'all' = toda la empresa. */
  branchId?: string;
  warehouseId?: string;
  locationId?: string;
}

export interface ProductsResponse {
  items: ApiProduct[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  nextPage: number | null;
  prevPage: number | null;
}

export const fetchProducts = async (params?: ProductsQueryParams): Promise<ProductsResponse> => {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.search) search.set("search", params.search);
  if (params?.category && params.category !== 'all') search.set("category", params.category);
  if (params?.supplier) search.set("supplier", params.supplier);
  if (params?.includeDeleted) search.set("includeDeleted", "true");
  if (params?.forSaleOnly) search.set("forSale", "true");
  if (params?.inBranchOnly) search.set("in_branch", "1");
  if (params?.branchId) search.set("branch_id", params.branchId);
  if (params?.warehouseId) search.set("warehouse_id", params.warehouseId);
  if (params?.locationId) search.set("location_id", params.locationId);

  const url = `/api/products${search.toString() ? `?${search.toString()}` : ""}`;
  const data = await apiFetch<ProductsResponse>(url, { method: "GET" });
  return data;
};

// Legacy function for backward compatibility (returns all products)
export const fetchAllProducts = async (options?: { forSaleOnly?: boolean; inBranchOnly?: boolean }): Promise<Product[]> => {
  const search = new URLSearchParams();
  search.set("pageSize", "10000");
  if (options?.forSaleOnly) search.set("forSale", "true");
  if (options?.inBranchOnly) search.set("in_branch", "1");
  const data = await apiFetch<ProductsResponse>(`/api/products?${search.toString()}`, { method: "GET" });
  if (!data || !data.items || !Array.isArray(data.items)) return [];
  return data.items.map(adaptApiProduct);
};

export const fetchProductById = async (id: string): Promise<ApiProduct | null> => {
  const data = await apiFetch<ApiProduct>(`/api/products/${id}`, { method: "GET" });
  return data ?? null;
};

export const fetchCriticalProducts = async (): Promise<Product[]> => {
  const data = await apiFetch<ApiProduct[]>("/api/products/critical", { method: "GET" });
  if (!Array.isArray(data)) return [];
  return data.map(adaptApiProduct);
};

export interface PricingPreviewRequest {
  customer_contact_id?: string | null;
  sales_channel?: string;
  product_ids: string[];
  price_tier?: "LIST" | "WHOLESALE" | "PROMOTION";
}

export interface PricingPreviewTierUnavailable {
  product_id: string;
  name: string;
  reason: string;
}

export interface PricingPreviewResponse {
  price_tier_used: string;
  sales_channel: string;
  unit_prices: Record<string, number>;
  tier_unavailable?: PricingPreviewTierUnavailable[];
}

export const postPricingPreview = async (
  body: PricingPreviewRequest
): Promise<PricingPreviewResponse> => {
  return apiFetch<PricingPreviewResponse>("/api/products/pricing-preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export type ProductAvailability = {
  stock: number;
  reserved: number;
  available: number;
  /** Solo con scope "pos": lo que hay en la ubicación de venta de la sucursal. */
  location_stock?: number;
  location_available?: number;
};

/** Ubicación de venta de la sucursal. Sin configurar, el POS no debe vender. */
export type SalesLocationInfo = { configured: boolean; id: string | null };

export async function fetchProductsAvailability(
  productIds: string[]
): Promise<Record<string, ProductAvailability>> {
  if (productIds.length === 0) return {};
  const q = new URLSearchParams({ ids: productIds.join(",") });
  const res = await apiFetch<{ availability: Record<string, ProductAvailability> }>(
    `/api/products/availability?${q.toString()}`,
    { method: "GET" }
  );
  return res.availability ?? {};
}

/**
 * Igual que la anterior pero para el punto de venta: agrega el stock de la
 * ubicación desde la que la caja despacha, y avisa si no hay ninguna configurada.
 */
export async function fetchPosAvailability(
  productIds: string[]
): Promise<{ availability: Record<string, ProductAvailability>; salesLocation: SalesLocationInfo }> {
  if (productIds.length === 0) {
    return { availability: {}, salesLocation: { configured: true, id: null } };
  }
  const q = new URLSearchParams({ ids: productIds.join(","), scope: "pos" });
  const res = await apiFetch<{
    availability: Record<string, ProductAvailability>;
    sales_location: SalesLocationInfo;
  }>(`/api/products/availability?${q.toString()}`, { method: "GET" });
  return {
    availability: res.availability ?? {},
    salesLocation: res.sales_location ?? { configured: false, id: null },
  };
}

export type CreateProductPayload = CreateProductPayloadType;

export const createProduct = async (payload: CreateProductPayload): Promise<ApiProduct> => {
  const data = await apiFetch<{ product?: ApiProduct } & ApiProduct>("/api/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return (data as { product?: ApiProduct }).product ?? data;
};

export type ProductBomResponse = {
  kind: string;
  components: import("@/types/product").ProductBomLineApi[];
};

export const fetchProductBom = async (productId: string): Promise<ProductBomResponse> => {
  return apiFetch<ProductBomResponse>(`/api/products/${encodeURIComponent(productId)}/bom`, {
    method: "GET",
  });
};

export const updateProductBom = async (
  productId: string,
  components: import("@/types/product").ProductBomComponentDraft[]
): Promise<ProductBomResponse> => {
  return apiFetch<ProductBomResponse>(`/api/products/${encodeURIComponent(productId)}/bom`, {
    method: "PUT",
    body: JSON.stringify({ components }),
  });
};

export const assembleKitStock = async (
  productId: string,
  qty?: number
): Promise<{ qty: number; product: ApiProduct }> => {
  return apiFetch<{ qty: number; product: ApiProduct }>(
    `/api/products/${encodeURIComponent(productId)}/kit/assemble`,
    { method: "POST", body: JSON.stringify(qty ? { qty } : {}) }
  );
};

export const deleteProduct = async (id: string): Promise<{ ok?: boolean }> => {
  const data = await apiFetch<{ ok?: boolean }>(`/api/products/${id}`, {
    method: "DELETE",
  });
  return data;
};

/** Quita el producto de la sucursal activa; en las demás sigue existiendo. */
export const removeProductFromBranch = async (id: string): Promise<{ ok?: boolean }> => {
  return apiFetch<{ ok?: boolean }>(`/api/products/${id}/branch-stock`, {
    method: "DELETE",
  });
};

// Download products PDF report (returns void; triggers browser download)
// options.fields: optional list of column keys. Omit for full card layout.
// options.ids: optional list of product IDs to export only those (if empty or omitted, exports all).
// options.includeSummary: if false, omits the summary block (productos registrados, unidades, valor inventario). Default true.
export interface ProductExportOptions {
  /** Columnas elegidas en el diálogo; sin ellas sale la ficha completa. */
  fields?: string[];
  /** Selección explícita de productos: manda sobre los filtros de pantalla. */
  ids?: string[];
  includeSummary?: boolean;
  format?: "pdf" | "csv";
  /** Mismo alcance y filtros que la lista, para que salga lo que se ve. */
  scope?: {
    branchId?: string;
    warehouseId?: string;
    locationId?: string;
    search?: string;
    category?: string;
    inBranchOnly?: boolean;
  };
}

/** Exporta el inventario que se está viendo, en PDF o CSV. */
export const exportProducts = async (options?: ProductExportOptions): Promise<void> => {
  const params = new URLSearchParams();
  if (options?.fields?.length) params.set("fields", options.fields.join(","));
  if (options?.ids?.length) params.set("ids", options.ids.join(","));
  if (options?.includeSummary === false) params.set("includeSummary", "0");
  if (options?.format === "csv") params.set("format", "csv");
  const scope = options?.scope;
  if (scope?.branchId) params.set("branch_id", scope.branchId);
  if (scope?.warehouseId) params.set("warehouse_id", scope.warehouseId);
  if (scope?.locationId) params.set("location_id", scope.locationId);
  if (scope?.search) params.set("search", scope.search);
  if (scope?.category && scope.category !== "all") params.set("category", scope.category);
  if (scope?.inBranchOnly) params.set("in_branch", "1");

  const qs = params.toString();
  await downloadFile(
    `/products/report.pdf${qs ? `?${qs}` : ""}`,
    options?.format === "csv" ? "inventario.csv" : "inventario.pdf",
  );
};

export type UpdateProductPayload = UpdateProductPayloadType;

export const updateProduct = async (id: string, payload: UpdateProductPayload): Promise<ApiProduct> => {
  const data = await apiFetch<ApiProduct>(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data;
};


/** Empieza a manejar el producto en la sucursal activa (su stock arranca en 0). */
export const addProductToBranch = (productId: string) =>
  apiFetch<{ ok: true; already?: boolean }>(
    `/api/products/${encodeURIComponent(productId)}/branch-stock`,
    { method: "POST", body: JSON.stringify({}) }
  );

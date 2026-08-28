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
import type { Supplier, Status } from "@/types";
import { adaptApiProduct, type ApiProduct } from "./productService";

export interface ApiSupplier {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  products?: number | string | null;
  last_order?: string | null;
  total_purchases?: number | string | null;
  rating?: number | string | null;
  /** 0 = inactivo, 1 = activo (reemplaza status_id) */
  estado?: number | null;
  payment_terms_id?: number | string | null;
  // Para compatibilidad hacia atrás se mantiene category,
  // pero el nuevo diseño usa categories / categoryNames
  category?: { id: number | string; name: string } | null;
  categories?: { id: number | string; name: string }[] | null;
  categoryNames?: string[] | null;
  payment_term?: { id: number | string; name: string } | null;
  /** Varios términos (respuesta API normalizada) */
  payment_terms?: Array<{
    payment_term_id: number;
    is_default?: boolean;
    sort_order?: number;
    name?: string;
    net_days?: number | null;
  }>;
  productsList?: ApiProduct[] | null;
  party_type?: string | null;
  tax_id?: string | null;
  entity_kind?: string | null;
  [key: string]: unknown;
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const normalizeStatusName = (name: string): Status | string => {
  const n = name.trim().toLowerCase();
  if (["activo", "active"].includes(n)) return "active";
  if (["inactivo", "inactive"].includes(n)) return "inactive";
  if (["pendiente", "pending"].includes(n)) return "pending";
  if (["completado", "completed"].includes(n)) return "completed";
  if (["resuelto", "resolved"].includes(n)) return "resolved";
  return name;
};

const mapStatus = (status?: string | number | null): Status | string => {
  if (typeof status === "string") return normalizeStatusName(status);
  if (typeof status === "number") {
    return status === 0 ? "inactive" : "active";
  }
  return "active";
};

// Format date/time removing timezone info (DB stores Guatemala time as-is)
const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "N/A";
  // Remove timezone info if present - DB stores Guatemala time as-is
  const cleanDate = dateStr.replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '');
  const d = new Date(cleanDate);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
};

export const adaptApiSupplier = (s: ApiSupplier): Supplier => {
  const categoriesFromApi = Array.isArray(s.categories)
    ? s.categories.map(c => ({ id: c.id, name: String(c.name) }))
    : []

  const categoryNamesFromApi =
    Array.isArray(s.categoryNames) && s.categoryNames.length > 0
      ? s.categoryNames
      : (categoriesFromApi.map(c => c.name))

  const categoryLabel =
    categoryNamesFromApi.length > 0
      ? categoryNamesFromApi.join(", ")
      : (s.category?.name ?? "");
  const statusRaw: string | number | undefined = s.estado !== undefined && s.estado !== null ? Number(s.estado) : undefined;

  const ptLinksRaw = Array.isArray(s.payment_terms) ? s.payment_terms : [];
  const ptLinksSorted = [...ptLinksRaw].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const paymentTerms =
    ptLinksSorted.length > 0
      ? ptLinksSorted
          .map((x) =>
            x.is_default
              ? `${x.name ?? ""} (predeterminado)`.trim()
              : (x.name ?? "").trim()
          )
          .filter(Boolean)
          .join(", ")
      : (s.payment_term?.name ?? "");
  const defPt = ptLinksSorted.find((x) => x.is_default) || ptLinksSorted[0];
  const payment_terms_id =
    defPt?.payment_term_id != null
      ? Number(defPt.payment_term_id)
      : s.payment_terms_id != null
        ? Number(s.payment_terms_id)
        : undefined;
  const paymentTermsList =
    ptLinksSorted.length > 0
      ? ptLinksSorted.map((x) => ({
          id: Number(x.payment_term_id),
          name: String(x.name ?? ""),
          isDefault: Boolean(x.is_default),
          netDays:
            x.net_days != null && x.net_days !== ""
              ? Number(x.net_days)
              : undefined,
        }))
      : undefined;

  const productsList = Array.isArray(s.productsList)
    ? s.productsList.map(adaptApiProduct)
    : undefined;

  const rawRules = (s as { customer_price_rules?: unknown }).customer_price_rules;
  const customerPriceRules = Array.isArray(rawRules)
    ? rawRules.map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        channel: (r.channel as string | null) ?? null,
        price_tier: String(r.price_tier ?? "LIST"),
        priority: Number(r.priority ?? 0),
        active: Boolean(r.active !== false),
      }))
    : undefined;

  const dpt = (s as { default_price_tier?: string }).default_price_tier;
  const defaultPriceTier =
    dpt === "WHOLESALE" || dpt === "PROMOTION" || dpt === "LIST" ? dpt : "LIST";

  const pt = s.party_type === "CUSTOMER" ? "CUSTOMER" : "SUPPLIER";
  const entityKind = s.entity_kind === "PERSON" ? "PERSON" : "ORGANIZATION";
  const taxId =
    s.tax_id != null && String(s.tax_id).trim() !== "" ? String(s.tax_id).trim() : undefined;
  return {
    id: String(s.id),
    party_type: pt,
    entityKind,
    name: s.name,
    taxId,
    contact: s.contact ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    category: categoryLabel || "",
    products: toNumber(s.products, 0),
    lastOrder: formatDateTime(s.last_order),
    totalPurchases: toNumber(s.total_purchases, 0),
    rating: toNumber(s.rating, 0),
    estado: s.estado !== undefined && s.estado !== null ? Number(s.estado) : 1,
    status: mapStatus(statusRaw),
    paymentTerms: paymentTerms,
    paymentTermsList,
    payment_terms_id,
    categories: categoriesFromApi,
    categoriesLabel: categoryLabel || undefined,
    productsList,
    defaultPriceTier: pt === "CUSTOMER" ? defaultPriceTier : undefined,
    customerPriceRules: pt === "CUSTOMER" ? customerPriceRules : undefined,
  };
};

export interface SuppliersQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category_id?: number | string;
  /** Filtra por tipo de contacto en API (SUPPLIER | CUSTOMER) */
  party_type?: string;
}

/** Desplegables de proveedor (productos, ingreso mercancía): solo contactos tipo proveedor, no clientes. */
export const SUPPLIERS_DROPDOWN_PARAMS: SuppliersQueryParams = {
  party_type: "SUPPLIER",
  page: 1,
  pageSize: 100,
};

export interface SuppliersResponse {
  items: Supplier[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  nextPage: number | null;
  prevPage: number | null;
}

export const fetchSuppliers = async (params?: SuppliersQueryParams): Promise<SuppliersResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.pageSize) queryParams.append("pageSize", String(params.pageSize));
  if (params?.search) queryParams.append("search", params.search);
  if (params?.category_id) queryParams.append("category_id", String(params.category_id));
  if (params?.party_type) queryParams.append("party_type", String(params.party_type));

  const url = `/api/suppliers${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const data = await apiFetch<{
    items: ApiSupplier[];
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    nextPage: number | null;
    prevPage: number | null;
  }>(url, { method: "GET" });
  
  return {
    items: Array.isArray(data.items) ? data.items.map(adaptApiSupplier) : [],
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 20,
    totalPages: data.totalPages ?? 1,
    totalItems: data.totalItems ?? 0,
    nextPage: data.nextPage ?? null,
    prevPage: data.prevPage ?? null,
  };
};

// Helper function to fetch all suppliers (for components that need the full list)
export const fetchAllSuppliers = async (): Promise<Supplier[]> => {
  const response = await fetchSuppliers({ page: 1, pageSize: 1000, party_type: "SUPPLIER" });
  return response.items;
};

export interface CreateSupplierPayload {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  party_type?: "SUPPLIER" | "CUSTOMER";
  // Nuevo contrato: enviar múltiples categorías (ids numéricos o string)
  category_ids?: Array<number | string>;
  /** 0 = inactivo, 1 = activo */
  estado?: number;
  /** Un término (compat); preferir payment_terms */
  payment_terms_id?: number | string;
  /** Varios términos; exactamente uno con is_default true */
  payment_terms?: Array<{
    payment_term_id: number;
    is_default: boolean;
    sort_order?: number;
  }>;
  rating?: number;
  /** ID fiscal (NIT, VAT, RFC, …); opcional */
  tax_id?: string | null;
  /** Solo clientes. null = sin límite. */
  credit_limit?: number | string | null;
  /** Persona individual vs empresa */
  entity_kind?: "PERSON" | "ORGANIZATION";
  /** Solo clientes: tarifa por defecto si no hay regla de canal */
  default_price_tier?: "LIST" | "WHOLESALE" | "PROMOTION";
}

export const createSupplier = async (payload: CreateSupplierPayload): Promise<ApiSupplier> => {
  const data = await apiFetch<ApiSupplier>("/api/suppliers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data;
};

export const fetchSupplierById = async (id: string): Promise<ApiSupplier | null> => {
  const data = await apiFetch<ApiSupplier>(`/api/suppliers/${id}`, { method: "GET" });
  return data ?? null;
};

export const updateSupplier = async (id: string, payload: Partial<CreateSupplierPayload>): Promise<ApiSupplier> => {
  const data = await apiFetch<ApiSupplier>(`/api/suppliers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data;
};

export type CustomerPriceRuleInput = {
  channel?: "" | "POS" | "WHOLESALE" | "ONLINE" | null;
  price_tier: "LIST" | "WHOLESALE" | "PROMOTION";
  priority?: number;
  active?: boolean;
};

export const replaceSupplierPriceRules = async (
  supplierId: string,
  rules: CustomerPriceRuleInput[]
): Promise<{ rules: Array<Record<string, unknown>> }> => {
  return apiFetch<{ rules: Array<Record<string, unknown>> }>(`/api/suppliers/${supplierId}/price-rules`, {
    method: "PUT",
    body: JSON.stringify({ rules }),
  });
};

export const deleteSupplier = async (id: string): Promise<{ ok?: boolean } | null> => {
  const data = await apiFetch<{ ok?: boolean }>(`/api/suppliers/${id}`, { method: "DELETE" });
  return data ?? null;
};
 

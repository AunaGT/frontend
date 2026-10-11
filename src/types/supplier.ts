/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { BaseEntity, ProductCategory, Status } from "./common";
import type { Product } from "./product";

// Interfaz principal de proveedor / contacto (API: suppliers + party_type)
export interface Supplier extends BaseEntity {
  /** SUPPLIER = proveedor, CUSTOMER = cliente */
  party_type?: "SUPPLIER" | "CUSTOMER";
  /** Persona física vs empresa */
  entityKind?: "PERSON" | "ORGANIZATION";
  name: string;
  imageUrl?: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  /** ID fiscal para facturas (NIT, VAT, RFC, etc.) */
  taxId?: string;
  // Etiqueta principal (por compatibilidad). Para múltiples categorías se usará categories / categoriesLabel
  category: ProductCategory | string;
  // Nuevos campos para múltiples categorías
  categories?: { id: number | string; name: string }[];
  /** Nombres de categorías separados por coma para mostrar en UI */
  categoriesLabel?: string;
  products: number;
  lastOrder: string;
  totalPurchases: number;
  rating: number;
  /** 0 = inactivo, 1 = activo (reemplaza status_id) */
  estado?: number;
  status: Status | string; // derivado de estado para UI (active/inactive)
  paymentTerms: string;
  /** Términos de pago asociados (API: payment_terms) */
  paymentTermsList?: { id: number; name: string; isDefault: boolean; netDays?: number }[];
  /** ID del término predeterminado (compatibilidad) */
  payment_terms_id?: number;
  productsList?: Product[]; // productos asociados desde API
  /** Cliente: tarifa por defecto (lista / mayoreo / promoción) */
  defaultPriceTier?: "LIST" | "WHOLESALE" | "PROMOTION";
  /** Cliente: reglas por canal (mayor prioridad primero) */
  customerPriceRules?: Array<{
    id: string;
    channel: string | null;
    price_tier: string;
    priority: number;
    active: boolean;
  }>;
}

// Interfaz para nuevo proveedor (form)
export interface NewSupplierForm {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  paymentTerms: string;
}

// Props del componente SuppliersManagement
export interface SuppliersManagementProps {
  suppliers?: Supplier[];
  onSupplierChange?: (suppliers: Supplier[]) => void;
}

// Estadísticas de proveedores
export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  totalProducts: number;
  avgRating: string;
}

// Términos de pago disponibles
export type PaymentTerms = "7 días" | "15 días" | "30 días" | "45 días";

// Categorías de proveedores
export type SupplierCategory = 
  | "Whisky/Licores Premium"
  | "Vinos"
  | "Cervezas" 
  | "Rones/Licores Nacionales"
  | "Vodkas/Ginebras";

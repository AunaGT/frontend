/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { BaseEntity, ProductCategory, StockStatus } from "./common";

export type ProductKind = "STANDARD" | "KIT";

export type ProductLotApi = {
  id: string;
  lot_code: string | null;
  expiry_date: string | null;
  qty_received: number;
  qty_remaining: number;
  received_at: string;
  is_system_generated: boolean;
  location: {
    id: string;
    code: string;
    name: string | null;
    warehouse: { id: string; code: string; name: string };
  } | null;
};

export type LotReconciliation = {
  physical: number;
  traced: number;
  difference: number;
  consistent: boolean;
};

export type ProductLotsResponse = {
  lots: ProductLotApi[];
  reconciliation: LotReconciliation;
};

export type ProductBomComponentDraft = {
  component_product_id: string;
  qty_per_unit: number;
  component_name?: string;
};

export type ProductBomLineApi = {
  id: string;
  component_product_id: string;
  qty_per_unit: number;
  sort_order?: number;
  component_product?: {
    id: string;
    name: string;
    barcode?: string | null;
    price?: number | string;
    stock?: number;
    kind?: ProductKind;
  };
};

export interface Product extends BaseEntity {
  name: string;
  category: ProductCategory | string; // Permitir string para flexibilidad
  brand: string;
  size: string;
  stock: number;
  minStock: number;
  price: number;
  /** Mayoreo (opcional). */
  priceWholesale?: number | null;
  /** Promoción vigente hasta `promotionValidUntil` (opcional). */
  pricePromotion?: number | null;
  promotionValidUntil?: string | null;
  cost: number;
  supplier: string;
  supplierId?: string; // ID del proveedor (para uso interno)
  barcode: string;
  description: string;
  imageUrl?: string;
  status: StockStatus | string; // Permitir string para flexibilidad
  deleted?: boolean; // Campo para soft delete
  deleted_at?: string | null; // Fecha de eliminación
  /** Si es false, no aparece en ventas (POS) y la API rechaza incluirlo en una venta. */
  availableForSale?: boolean;
  /** Si es true, cada ingreso de mercancía exige fecha de caducidad (lotes). */
  tracksExpiry?: boolean;
  kind?: ProductKind;
  /** false = el catálogo lo tiene, pero esta sucursal no lo maneja (no es "hay cero"). */
  inBranch?: boolean;
  /** Solo aplica a kits: true si ya se armó stock propio (permanente, ya no se calcula desde componentes). */
  stockAssembled?: boolean;
  kitComponents?: ProductBomLineApi[];
}

// Interfaz para nuevo producto (form)
export interface NewProductForm {
  name: string;
  category: string;
  brand: string;
  size: string;
  price: string;
  cost: string;
  stock: string;
  minStock: string;
  supplier: string;
  barcode: string;
  description: string;
}

// Interfaz para producto en carrito de ventas
export interface CartProduct {
  id: string;
  name: string;
  price: number;
  qty: number;
}

// Interfaz para producto disponible en ventas
export interface AvailableProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string;
}

// Props del componente ProductManagement
export interface ProductManagementProps {
  products?: Product[];
  onProductChange?: (products: Product[]) => void;
}

// Estadísticas de productos
export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
}

// API shapes and payloads used by services
export interface ApiProduct {
  id: string | number;
  name: string;
  category?: string | { id: string | number; name: string };
  category_id?: string | number;
  category_name?: string;
  brand?: string;
  size?: string;
  stock?: number | string;
  min_stock?: number | string;
  price?: number | string;
  price_wholesale?: number | string | null;
  price_promotion?: number | string | null;
  promotion_valid_until?: string | null;
  cost?: number | string;
   image_url?: string | null;
  supplier?: string | { id: string | number; name: string };
  supplier_id?: string | number;
  supplier_name?: string;
  barcode?: string;
  description?: string | null;
  status?: string | { id: string | number; name: string };
  status_id?: number | string;
  available_for_sale?: boolean;
  tracks_expiry?: boolean;
  kind?: ProductKind;
  stock_assembled?: boolean;
  in_branch?: boolean;
  kit_components?: ProductBomLineApi[];
  [key: string]: unknown;
}

export interface CreateProductPayload {
  id?: string;
  name: string;
  category_id: number | string;
  brand?: string;
  size?: string;
  stock?: number;
  min_stock?: number;
  price?: number;
  price_wholesale?: number | null;
  price_promotion?: number | null;
  promotion_valid_until?: string | null;
  cost?: number;
  image_url?: string;
  supplier_id?: string;
  barcode?: string;
  description?: string;
  status_id?: number;
  available_for_sale?: boolean;
  tracks_expiry?: boolean;
  kind?: ProductKind;
  bom_components?: ProductBomComponentDraft[];
}

export interface UpdateProductPayload extends CreateProductPayload {
  id: string;
}

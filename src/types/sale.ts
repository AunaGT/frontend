/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { BaseEntity, PaymentMethod, Status } from "./common";
import { CartProduct } from "./product";

// Tipo de estado específico para ventas
export type SaleStatus = "pending" | "paid" | "completed" | "cancelled" | "draft" | "legacy";
export type CommercialState='DRAFT'|'CONFIRMED'|'CANCELLED'|'LEGACY';
export type FiscalState='DISABLED'|'UNRECORDED'|'PENDING_CONNECTOR'|'RECORDED_EXTERNAL'|'AUTHORIZED'|'REVIEW_REQUIRED';
export type SaleCommercialView={state:CommercialState;originEngagementId:string|null;version:number;confirmedAt:string|null;fiscalState:FiscalState};

// Interfaz de detalle de devolución
export interface ReturnDetail {
  date: string;
  status: string;
  reason?: string;
  totalRefund: number;
  items: Array<{
    productName: string;
    qty: number | string;
    unitLabel?: string;
    refund: number;
  }>;
}

/** Documento tributario electrónico (InFile/SAT) vinculado a la venta */
export interface SaleDte {
  id?: string;
  document_type?: string;
  authorization?: string;
  series?: string;
  number?: string;
  emission_date?: string;
  status?: string;
  provider?: string;
  xml_url?: string;
  pdf_url?: string;
}

// Interfaz de promoción aplicada a venta
export interface SalePromotion {
  id: number;
  promotion_id: string;
  discount_applied: number;
  code_used?: string;
  promotion?: {
    id: string;
    name: string;
    type?: {
      name: string;
    };
  };
}

// Interfaz principal de venta
export interface Sale extends BaseEntity {
  settlementSource?: 'LEGACY' | 'ENGAGEMENT_RECEIPTS' | 'MANUAL_SALE';
  commercial?:SaleCommercialView;
  capabilities?:{confirm:boolean;requestInvoice:boolean;collect:boolean;reason:string;editManual?:boolean;confirmManual?:boolean;cancelManual?:boolean};
  isCredit?: boolean;
  dueDate?: string;
  creditPaid?: number;
  creditBalance?: number;
  paymentStatus?: 'PENDING' | 'PARTIAL' | 'PAID';
  /** Referencia legible (ej. V-000001). Se usa en UI y ticket; el id sigue siendo el UUID para la API. */
  reference?: string;
  date: string;
  customer: string;
  customerNit?: string; // NIT del cliente (opcional)
  customerContact?: { id: string; name: string; imageUrl?: string; address?: string; phone?: string; email?: string; taxId?: string };
  branchName?: string;
  isFinalConsumer: boolean; // Si es consumidor final (CF)
  total: number;
  subtotal?: number; // Subtotal antes de descuentos
  discountTotal?: number; // Total de descuentos aplicados
  totalReturned?: number; // Total devuelto
  adjustedTotal?: number; // Total ajustado (total - devoluciones)
  hasReturns?: boolean; // Indica si tiene devoluciones
  returnDetails?: ReturnDetail[]; // Detalles de las devoluciones
  promotions?: SalePromotion[]; // Promociones aplicadas
  items: number;
  lineCount?: number;
  payment: PaymentMethod | null;
  status: SaleStatus;
  amountReceived: number;
  change: number;
  products: CartProduct[];
  // Usuario que registró la venta (opcional)
  createdById?: string;
  createdByName?: string;
  createdByEmail?: string;
  // Facturación electrónica (InFile/SAT) - cuando esté conectada
  sale_dtes?: SaleDte[];
}

// Interfaz para nueva venta (form)
export interface NewSaleForm {
  customer: string;
  customerNit: string;
  isFinalConsumer: boolean;
  paymentMethod: PaymentMethod;
  cartItems: CartProduct[];
  amountReceived: string;
}

// Props del componente SalesManagement
export interface SalesManagementProps {
  sales?: Sale[];
  onSaleChange?: (sales: Sale[]) => void;
}

// Estadísticas de ventas
export interface SalesStats {
  totalSales: number;
  todaySales: number;
  totalRevenue: number;
  todayRevenue: number;
  averageTicket: number;
}

// Resumen de venta para reportes
export interface SaleSummary {
  total: number;
  subtotal: number;
  tax: number;
  itemsCount: number;
  paymentMethod: PaymentMethod;
  change?: number;
}

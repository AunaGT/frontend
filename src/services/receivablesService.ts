/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Cartera (cuentas por cobrar) de la empresa y sucursal activas. La sucursal
 * viaja en las cabeceras que agrega apiFetch, así que aquí no se pasa nunca.
 */
import { apiFetch } from "./api";

export type SalePaymentStatus = "PENDING" | "PARTIAL" | "PAID";

export const SALE_PAYMENT_STATUS_LABELS: Record<SalePaymentStatus, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Abonada",
  PAID: "Pagada",
};

/** Rangos de antigüedad, en el orden en que se muestran. */
export const AGING_BUCKETS = [
  { key: "corriente", label: "Corriente" },
  { key: "d1_30", label: "1-30 días" },
  { key: "d31_60", label: "31-60 días" },
  { key: "d61_90", label: "61-90 días" },
  { key: "d90_mas", label: "+90 días" },
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

export interface ReceivableRow {
  customer_id: string;
  customer_name: string;
  credit_limit: number | null;
  saldo: number;
  vencido: number;
  facturas: number;
  vence_primero: string | null;
}

export interface ReceivablesList {
  items: ReceivableRow[];
  total_por_cobrar: number;
  total_vencido: number;
}

export type AgingRow = {
  customer_id: string;
  customer_name: string;
  total: number;
} & Record<AgingBucketKey, number>;

export interface AgingReport {
  items: AgingRow[];
  totales: Record<AgingBucketKey, number> & { total: number };
}

export interface StatementSale {
  id: string;
  reference: string | null;
  date: string;
  due_date: string | null;
  total: number;
  abonado: number;
  saldo: number;
  payment_status: SalePaymentStatus;
  vencida: boolean;
  dias_vencida: number;
}

export interface StatementPayment {
  id: string;
  amount: number;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  payment_method: { id: number; name: string } | null;
  registered_by: { id: string; name: string } | null;
  aplicaciones: { sale_id?: string; reference?: string | null; amount: number }[];
}

export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    contact: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    tax_id: string | null;
    credit_limit: number | null;
  };
  resumen: {
    saldo: number;
    vencido: number;
    facturas_abiertas: number;
    facturas_vencidas: number;
    disponible: number | null;
  };
  ventas: StatementSale[];
  cobros: StatementPayment[];
}

export interface CreditCheck {
  customer_id: string;
  customer_name: string;
  ok: boolean;
  saldo_actual: number;
  saldo_resultante: number;
  limite: number | null;
  vencido: number;
  facturas_vencidas: number;
  motivo: string | null;
}

export interface CreatePaymentPayload {
  customer_id: string;
  amount: number;
  payment_method_id: number;
  paid_at?: string;
  reference?: string;
  notes?: string;
  cash_register_session_id?: string;
}

export interface CreatedPayment {
  id: string;
  amount: number;
  aplicaciones: {
    sale_id?: string;
    reference?: string | null;
    payment_status?: SalePaymentStatus;
    amount: number;
  }[];
  resumen: { saldo: number; vencido: number; facturas_abiertas: number; facturas_vencidas: number };
}

export const fetchReceivables = () => apiFetch<ReceivablesList>("/api/receivables");

export const fetchAging = () => apiFetch<AgingReport>("/api/receivables/aging");

export const fetchOverdueCount = () =>
  apiFetch<{ count: number; monto: number }>("/api/receivables/overdue-count");

export const fetchCustomerStatement = (customerId: string) =>
  apiFetch<CustomerStatement>(`/api/receivables/customers/${customerId}`);

/** Consulta previa del POS: ¿puede este cliente llevarse este monto al crédito? */
export const checkCustomerCredit = (customerId: string, amount: number) =>
  apiFetch<CreditCheck>(
    `/api/receivables/customers/${customerId}/credit-check?amount=${encodeURIComponent(String(amount))}`
  );

export const createCustomerPayment = (payload: CreatePaymentPayload) =>
  apiFetch<CreatedPayment>("/api/receivables/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteCustomerPayment = (id: string) =>
  apiFetch<{
    deleted: string;
    ventas_afectadas: number;
    had_journal_entry: boolean;
    journal_entry_number: string | null;
  }>(`/api/receivables/payments/${id}`, { method: "DELETE" });

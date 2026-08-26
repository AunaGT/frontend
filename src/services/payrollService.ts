/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Planillas de la empresa y sucursal activas. */
import { apiFetch } from "./api";

export type PayrollType = "ORDINARIA" | "AGUINALDO" | "BONO14";
export type PayrollStatus = "BORRADOR" | "CONFIRMADA" | "PAGADA" | "ANULADA";
export type PayslipLineType = "DEVENGO" | "DEDUCCION" | "COSTO_PATRONAL";

export const PAYROLL_TYPE_LABELS: Record<PayrollType, string> = {
  ORDINARIA: "Ordinaria",
  AGUINALDO: "Aguinaldo",
  BONO14: "Bono 14",
};

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  BORRADOR: "Borrador",
  CONFIRMADA: "Confirmada",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

export interface PayslipLine {
  id: string;
  concept: string;
  type: PayslipLineType;
  description: string;
  quantity: string | null;
  amount: string;
  advance_id: string | null;
  sort_order: number;
}

export interface Payslip {
  id: string;
  employee_id: string;
  base_salary: string;
  days_worked: string;
  igss_base: string;
  isr_base: string;
  total_earnings: string;
  total_deductions: string;
  net_pay: string;
  employer_cost: string;
  employee?: {
    id: string; code: string; first_name: string; last_name: string; position: string | null; igss_number: string | null;
    payment_method: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE"; bank_name: string | null; bank_account: string | null;
  };
  lines: PayslipLine[];
}

export interface PayrollRunSummary {
  id: string;
  code: string;
  name: string;
  type: PayrollType;
  status: PayrollStatus;
  period_start: string;
  period_end: string;
  pay_date: string;
  total_earnings: string;
  total_deductions: string;
  total_net: string;
  total_employer_cost: string;
  branch?: { id: string; name: string };
  _count?: { payslips: number };
}

export interface PayrollRun extends PayrollRunSummary {
  notes: string | null;
  payslips: Payslip[];
}

export interface PayrollRunPayload {
  name?: string;
  type?: PayrollType;
  period_start?: string;
  period_end?: string;
  pay_date: string;
  notes?: string;
  overtime?: Record<string, number>;
}

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : "";
};

export const fetchPayrollRuns = (filters: { year?: string; type?: string; status?: string } = {}) =>
  apiFetch<{ items: PayrollRunSummary[] }>(`/api/payroll/runs${qs(filters)}`);

export const fetchPayrollRun = (id: string) => apiFetch<PayrollRun>(`/api/payroll/runs/${id}`);

export const createPayrollRun = (payload: PayrollRunPayload) =>
  apiFetch<PayrollRun>("/api/payroll/runs", { method: "POST", body: JSON.stringify(payload) });

export const recalculatePayrollRun = (id: string, overtime?: Record<string, number>) =>
  apiFetch<PayrollRun>(`/api/payroll/runs/${id}/recalculate`, {
    method: "POST",
    body: JSON.stringify({ overtime: overtime ?? {} }),
  });

export const confirmPayrollRun = (id: string) =>
  apiFetch<PayrollRun>(`/api/payroll/runs/${id}/confirm`, { method: "POST" });

export const payPayrollRun = (id: string) =>
  apiFetch<PayrollRun>(`/api/payroll/runs/${id}/pay`, { method: "POST" });

export const cancelPayrollRun = (id: string) =>
  apiFetch<PayrollRun>(`/api/payroll/runs/${id}/cancel`, { method: "POST" });

export const deletePayrollRun = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/payroll/runs/${id}`, { method: "DELETE" });

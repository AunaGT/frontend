import { apiFetch } from "@/services/api";
import type {
  PayableFilters,
  Page,
  PayableEntry,
  PayableSummary,
  PayableSupplier,
  PayableAging,
  SupplierReceipt,
  SupplierPaymentInput,
  SupplierStatement,
  PayablesExport,
} from "./payablesTypes";
const base = "/api/incoming-merchandise/payables";
const query = (filters: PayableFilters = {}) => {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  return "?" + p;
};
export const fetchPayableEntries = (f: PayableFilters = {}) =>
  apiFetch<Page<PayableEntry>>(base + "/entries" + query(f));
export const fetchPayableSummary = (f: PayableFilters = {}) =>
  apiFetch<PayableSummary>(base + "/summary" + query(f));
export const fetchPayableSuppliers = (f: PayableFilters = {}) =>
  apiFetch<Page<PayableSupplier>>(base + "/suppliers" + query(f));
export const fetchPayableAging = (f: PayableFilters = {}) =>
  apiFetch<Page<PayableAging>>(base + "/aging" + query(f));
export const fetchSupplierStatement = (id: string, f: PayableFilters = {}) =>
  apiFetch<SupplierStatement>(
    base + "/suppliers/" + encodeURIComponent(id) + query(f),
  );
export const fetchSupplierReceipt = (id: string) =>
  apiFetch<SupplierReceipt>(base + "/payments/" + encodeURIComponent(id));
export const fetchPayableSelection = (ids: string[]) =>
  apiFetch<PayableEntry[]>(base + "/selection", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
export const createSupplierPayment = (body: SupplierPaymentInput) =>
  apiFetch<SupplierReceipt>(base + "/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const cancelSupplierPayment = (id: string, reason: string) =>
  apiFetch<SupplierReceipt>(
    base + "/payments/" + encodeURIComponent(id) + "/cancel",
    { method: "POST", body: JSON.stringify({ reason }) },
  );
export const correctHistoricalSettlement = (
  id: string,
  amount: string,
  expectedRevision: number,
  reason: string,
) =>
  apiFetch(base + "/entries/" + encodeURIComponent(id) + "/correct", {
    method: "POST",
    body: JSON.stringify({ amount, expectedRevision, reason }),
  });
export const fetchPayablesExport = (f: PayableFilters = {}) =>
  apiFetch<PayablesExport>(base + "/export" + query(f));

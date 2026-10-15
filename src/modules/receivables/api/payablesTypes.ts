export type PayableFilters = {
  search?: string;
  supplierId?: string;
  state?: string;
  dateFrom?: string;
  dateTo?: string;
  dueFrom?: string;
  dueTo?: string;
  page?: number;
  pageSize?: number;
  entryPage?: number;
  paymentPage?: number;
  auditPage?: number;
};
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
export type PayableEntry = {
  id: string;
  reference: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  date: string;
  dueDate: string | null;
  total: string;
  documentedPaid: string;
  legacySettled: string;
  balance: string | null;
  status: "PAID" | "PARTIAL" | "PENDING" | "REVIEW";
  revision: number;
  overdue: boolean;
  overdueDays: number;
  excluded: boolean;
  reason: string | null;
};
export type PayableSummary = {
  pending: string;
  overdue: string;
  upcoming30Days: string;
  supplierCount: number;
  reviewCount: number;
  complete: boolean;
  asOf: string;
  timezone: string;
};
export type PayableSupplier = {
  id: string;
  name: string;
  pending: string;
  overdue: string;
  entries: number;
  nextDue: string | null;
  reviewCount: number;
};
export type PayableAging = {
  id: string;
  name: string;
  current: string;
  d1_30: string;
  d31_60: string;
  d61_90: string;
  d90_plus: string;
  undated: string;
  review_count: number;
};
export type PaymentApplication = {
  incomingId: string;
  amount: string;
  expectedRevision: number;
};
export type SupplierPaymentInput = {
  requestKey: string;
  supplierId: string;
  amount: string;
  currencyCode: string;
  paidAt: string;
  paymentMethodId: number;
  reference: string | null;
  notes: string | null;
  applications: PaymentApplication[];
};
export type SupplierReceipt = {
  id: string;
  status: "POSTED" | "CANCELLED";
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierName: string;
  amount: string;
  currencyCode: string;
  paidAt: string;
  paymentMethod: { id: number; name: string } | null;
  reference: string | null;
  notes: string | null;
  registeredBy: { id: string; name: string };
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: { id: string; name: string } | null;
  cancelReason: string | null;
  applications: {
    incomingId: string;
    reference: string;
    amount: string;
    cancelledAt: string | null;
  }[];
};
export type PayableAudit = {
  id: string;
  action: string;
  reason: string | null;
  created_at: string;
  actor: { id: string; name: string };
  before: unknown;
  after: unknown;
};
export type SupplierStatement = {
  supplier: {
    id: string;
    name: string;
    tax_id: string | null;
    address: string | null;
  };
  summary: PayableSummary;
  entries: Page<PayableEntry>;
  payments: Page<
    Pick<
      SupplierReceipt,
      | "id"
      | "status"
      | "amount"
      | "paidAt"
      | "reference"
      | "registeredBy"
      | "paymentMethod"
      | "cancelReason"
    > & { kind: "RECEIPT" | "LEGACY"; incomingId: string | null }
  >;
  audit: Page<PayableAudit>;
};
export type PayablesExport = {
  items: PayableEntry[];
  asOf: string;
  filters: PayableFilters;
  summary: { pending: string; reviewCount: number; complete: boolean };
  branding: {
    companyId: string;
    companyName: string;
    companyLogoUrl: string | null;
    currencyCode: string;
    locale: string;
    timezone: string;
    scopeLabel: string;
    branches: { id: string; name: string }[];
  };
};

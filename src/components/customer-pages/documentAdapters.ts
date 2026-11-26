import type { PublicQuote } from "@/services/quoteService";
import type { PublicOrder } from "@/services/orderService";
import type { PublicDocumentContext } from "./types";
import { serviceConditionText } from "@/services/serviceConditions";
import {safeEventPaymentTerms} from '@/services/eventPaymentTerms';
import {publicCommercialPackageGroups} from '@/components/shared/CommercialPackageSummary'
const value = (n: unknown) => (n === null || n === undefined ? "0" : String(n));
function subtotal(total: unknown, discount: unknown) {
  const decimals = (v: unknown) => {
    const s = value(v);
    if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return 0n;
    const [a, b = ""] = s.split(".");
    return BigInt(a) * 100n + BigInt(b.padEnd(2, "0"));
  };
  const cents = decimals(total) + decimals(discount);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
export function quoteContext(dto: PublicQuote): PublicDocumentContext {
  const expired =
    dto.status === "SENT" &&
    !!dto.valid_until &&
    new Date(dto.valid_until).getTime() <= Date.now();
  return {
    documentType: "QUOTE",
    reference: dto.reference || "",
    status: expired ? "EXPIRED" : dto.status,
    companyName: dto.company_name,
    companyLogo: dto.company_logo_url,
    customer: dto.customer || undefined,
    customerNit: dto.is_final_consumer ? "CF" : dto.customer_nit || undefined,
    createdAt: dto.created_at,
    validUntil: dto.valid_until || undefined,
    notes: dto.notes || undefined,
    paymentCondition: dto.payment_condition,
    ...(dto.eventPaymentTerms?{eventPaymentTerms:safeEventPaymentTerms(dto.eventPaymentTerms)}:{}),
    creditDays: dto.credit_days || undefined,
    subtotal:
      dto.subtotal == null
        ? subtotal(dto.total, dto.discount_total)
        : value(dto.subtotal),
    discount: value(dto.discount_total),
    total: value(dto.total),
    currency: dto.currency_code || "GTQ",
    locale: dto.locale || "es-GT",
    timezone: dto.timezone || "America/Guatemala",
    canRespond: dto.status === "SENT" && !expired,
    ...(dto.packageGroups?.length?{packageGroups:publicCommercialPackageGroups(dto.packageGroups)}:{}),
    lines: dto.lines.map((l) => ({
      ...(l.package_component_key?{packageComponentKey:l.package_component_key}:{}),
      name: l.product_name || "Producto",
      code: l.barcode || undefined,
      image: l.image_url || undefined,
      qty: value(l.qty),
      unitLabel: l.unit_label || undefined,
      unitPrice: value(l.unit_price),
      total: value(l.line_total),
      conditions: l.service_schedule_snapshot
        ? serviceConditionText(l.service_schedule_snapshot)
        : undefined,
    })),
  };
}
export function orderContext(dto: PublicOrder): PublicDocumentContext {
  return {
    documentType: "ORDER",
    reference: dto.reference || "",
    status: dto.status,
    companyName: dto.company_name,
    companyLogo: dto.company_logo_url,
    customer: dto.customer || dto.customer_contact?.name || undefined,
    customerNit: dto.is_final_consumer ? "CF" : dto.customer_nit || undefined,
    createdAt: dto.created_at,
    validUntil: dto.valid_until || undefined,
    notes: dto.notes || undefined,
    paymentCondition: dto.payment_condition,
    ...(dto.eventPaymentTerms?{eventPaymentTerms:safeEventPaymentTerms(dto.eventPaymentTerms)}:{}),
    creditDays: dto.credit_days || undefined,
    subtotal:
      dto.subtotal == null
        ? subtotal(dto.total, dto.discount_total)
        : value(dto.subtotal),
    discount: value(dto.discount_total),
    total: value(dto.total),
    currency: dto.currency_code || "GTQ",
    locale: dto.locale || "es-GT",
    timezone: dto.timezone || "America/Guatemala",
    ...(dto.packageGroups?.length?{packageGroups:publicCommercialPackageGroups(dto.packageGroups)}:{}),
    lines: dto.lines.map((l) => ({
      ...(l.package_component_key?{packageComponentKey:l.package_component_key}:{}),
      name: l.product_name || "Producto",
      code: l.barcode || undefined,
      qty: value(l.qty),
      unitLabel: l.unit_label || undefined,
      fulfilled: value(
        l.unit_metadata_version === 2 ? l.base_fulfilled : l.qty_fulfilled,
      ),
      fulfilledUnitLabel:
        l.unit_metadata_version === 2
          ? l.unit_snapshot?.baseUnit.label
          : l.unit_label || undefined,
      unitPrice: value(l.unit_price),
      total: value(l.line_total),
    })),
    sales: dto.sales.map((s) => ({
      reference: s.reference || "Venta",
      total: value(s.total),
      date: s.date || undefined,
      status: s.status || undefined,
    })),
  };
}
export function publicPortalAssetUrl(
  type: "QUOTE" | "ORDER",
  token: string,
  key: string,
  versionId: string,
) {
  return `/api/public/customer-pages/${type}/${encodeURIComponent(token)}/versions/${encodeURIComponent(versionId)}/assets/${encodeURIComponent(key)}`;
}

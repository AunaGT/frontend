import type {
  DocumentType,
  PublicDocumentContext,
} from "@/components/customer-pages/types";
export const scenarioNames: Record<DocumentType, string[]> = {
  QUOTE: ["SENT", "ACCEPTED", "REJECTED", "EXPIRED", "UNAVAILABLE", "EXTREME"],
  ORDER: [
    "CONFIRMED",
    "PARTIALLY_FULFILLED",
    "FULFILLED",
    "CANCELLED",
    "UNAVAILABLE",
    "EXTREME",
  ],
};
export function getPreviewScenario(
  type: DocumentType,
  scenario: string,
): PublicDocumentContext {
  const status =
    scenario === "EXTREME"
      ? type === "QUOTE"
        ? "SENT"
        : "PARTIALLY_FULFILLED"
      : scenario;
  return {
    documentType: type,
    companyName: "Estudio Horizonte · Ejemplo",
    reference: type === "QUOTE" ? "COT-EJEMPLO-001" : "PED-EJEMPLO-001",
    customer: "Andrea López · Datos de ejemplo",
    customerNit: "CF",
    status,
    canRespond: type === "QUOTE" && status === "SENT",
    createdAt: "2026-10-25",
    validUntil: "2026-11-25",
    currency: "GTQ",
    locale: "es-GT",
    timezone: "America/Guatemala",
    subtotal: "475.50",
    discount: "25.00",
    total: "450.50",
    notes:
      "Precios y condiciones ilustrativos. Ninguna acción registra una operación.",
    paymentCondition: "CREDIT",
    creditDays: 15,
    lines: Array.from({ length: scenario === "EXTREME" ? 120 : 3 }, (_, i) => ({
      name:
        i === 0
          ? "Consultoría de diseño"
          : i === 1
            ? "Café de origen · Presentación 250 g"
            : "Producto de ejemplo " + (i + 1),
      qty: "0.125",
      fulfilled:
        status === "FULFILLED"
          ? "0.125"
          : status === "PARTIALLY_FULFILLED"
            ? "0.025"
            : "0",
      unitLabel: i === 0 ? "hora" : "kg",
      unitPrice: "120.00",
      total: "15.00",
      conditions:
        i === 0 ? "Duración y horario se acuerdan con el asesor." : undefined,
    })),
    sales:
      type === "ORDER"
        ? [
            {
              reference: "Venta de ejemplo",
              total: "120.00",
              date: "2026-10-25",
            },
          ]
        : [],
  };
}

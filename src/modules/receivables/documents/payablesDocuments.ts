import {
  addJsPdfCompanyHeader,
  addDocumentFooter,
  addDocumentText,
  documentTableStyles,
} from "@/utils/pdfBranding";
import {
  generateReportWorkbook,
  generateReportCsv,
} from "@/modules/reports/documents/reportSpreadsheet";
import { downloadReportBlob } from "@/modules/reports/documents/reportDownload";
import type {
  ReportColumn,
  SpreadsheetDocument,
  CellValue,
} from "@/modules/reports/reportModel";
import type { PayablesExport, SupplierReceipt } from "../api/payablesTypes";
import {
  ensureCouponFonts,
  installCouponFonts,
  createCouponMeasure,
} from "@/modules/promotions/coupons/couponFonts";
import { textStyle } from "@/modules/promotions/coupons/couponDesign";
type Branding = PayablesExport["branding"];
type PdfBranding = {
  companyName: string;
  timezone: string;
  locale: string;
  logoDataUrl?: string;
};
// A spreadsheet may ignore leading control characters before a formula.
export const payablesCsvCell = (value: string) =>
  // eslint-disable-next-line no-control-regex -- spreadsheets may skip control prefixes before formulas.
  /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) ? "'" + value : value;
export const payableColumns: ReportColumn[] = [
  { id: "reference", label: "Entrada", type: "text", align: "left" },
  { id: "supplierName", label: "Proveedor", type: "text", align: "left" },
  { id: "branchName", label: "Sucursal", type: "text", align: "left" },
  { id: "date", label: "Emisión", type: "date", align: "left" },
  { id: "dueDate", label: "Vencimiento", type: "date", align: "left" },
  { id: "total", label: "Total", type: "money", align: "right" },
  {
    id: "documentedPaid",
    label: "Abonos documentados",
    type: "money",
    align: "right",
  },
  {
    id: "legacySettled",
    label: "Liquidación histórica",
    type: "money",
    align: "right",
  },
  { id: "balance", label: "Saldo", type: "money", align: "right" },
  { id: "status", label: "Estado", type: "text", align: "left" },
];
function numeric(value: string | null): number | string | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) &&
    Number.isSafeInteger(Math.round(n * 100)) &&
    Math.abs(n - Number(n.toFixed(2))) < 1e-8
    ? n
    : value;
}
export function preparePayableDocument(
  dataset: PayablesExport,
  branding: Branding,
  options: { columns?: string[] } = {},
) {
  const columns = payableColumns.filter(
    (c) => !options.columns || options.columns.includes(c.id),
  );
  if (!columns.length) throw Error("Selecciona al menos una columna");
  const rows = dataset.items.map(
    (r) =>
      Object.fromEntries(
        columns.map((c) => {
          const value = r[c.id as keyof typeof r];
          return [
            c.id,
            c.type === "money"
              ? numeric(value as string | null)
              : c.id === "status"
                ? {
                    PAID: "Pagado",
                    PARTIAL: "Parcial",
                    PENDING: "Pendiente",
                    REVIEW: "Por revisar",
                  }[r.status]
                : (value ?? null),
          ];
        }),
      ) as Record<string, CellValue>,
  );
  return {
    title: "Cuentas por pagar a proveedores",
    companyName: branding.companyName,
    scopeLabel: branding.scopeLabel,
    currencyCode: branding.currencyCode,
    locale: branding.locale,
    timezone: branding.timezone,
    asOf: dataset.asOf,
    columns,
    rows,
    warnings: [
      ...(!dataset.summary.complete
        ? [
            "Totales incompletos: hay " +
              dataset.summary.reviewCount +
              " entradas cuyo saldo requiere revisión. No se incluye un saldo desconocido como cero.",
          ]
        : []),
      "Registro administrativo. No constituye una factura ni ejecuta transferencias o movimientos de caja.",
    ],
    totals: { balance: dataset.summary.pending },
    filters: dataset.filters,
  };
}
export function toSpreadsheetDocument(
  prepared: ReturnType<typeof preparePayableDocument>,
  branding: Branding,
): SpreadsheetDocument {
  return {
    id: "supplier-payables",
    title: prepared.title,
    generatedAt: prepared.asOf,
    timezone: prepared.timezone,
    currency: prepared.currencyCode,
    generatedBy: null,
    scope: {
      companyId: branding.companyId,
      label: branding.scopeLabel,
      branches: branding.branches,
      warehouse: null,
      location: null,
    },
    period: {
      mode: "period",
      start: prepared.filters.dateFrom || null,
      endExclusive: null,
      label:
        "Filtros: " +
        (Object.entries(prepared.filters)
          .filter(([, v]) => v)
          .map(([k, v]) => k + ": " + v)
          .join(" · ") || "Todos"),
    },
    branding: { companyName: branding.companyName, logoDataUrl: null },
    summary: [
      {
        id: "pending",
        label: "Saldo conocido por pagar",
        type: "money",
        value: numeric(prepared.totals.balance),
      },
    ],
    sections: [
      {
        id: "entries",
        title: "Entradas de mercancía",
        columns: prepared.columns,
        rows: prepared.rows,
        totals: Object.fromEntries(
          prepared.columns
            .filter((c) => c.id === "balance")
            .map((c) => [c.id, numeric(prepared.totals.balance)]),
        ),
      },
    ],
    charts: [],
    notes: prepared.warnings,
  };
}
async function tablePdf(input: {
  title: string;
  branding: PdfBranding;
  metadata: string[];
  columns: string[];
  rows: string[][];
  cancelled?: boolean;
}): Promise<Blob> {
  await ensureCouponFonts(["NotoSans"]);
  const measure = await createCouponMeasure(["NotoSans"]);
  if (!measure.supports(JSON.stringify(input), textStyle({ font: "NotoSans" })))
    throw Error(
      "El PDF contiene caracteres no compatibles. Usa Excel o CSV para conservarlos.",
    );
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]),
    doc = new jsPDF({
      format: "a4",
      orientation: input.columns.length > 7 ? "landscape" : "portrait",
      compress: false,
    });
  installCouponFonts(doc, ["NotoSans"]);
  const font = "CouponNoto";
  let y = addJsPdfCompanyHeader(doc, {
    companyName: input.branding.companyName,
    logoDataUrl: input.branding.logoDataUrl,
    font,
  });
  doc.setFont(font, "bold");
  doc.setFontSize(15);
  y =
    addDocumentText(
      doc,
      input.title,
      18,
      y,
      doc.internal.pageSize.getWidth() - 36,
      6,
    ) + 4;
  doc.setFont(font, "normal");
  doc.setFontSize(9);
  for (const text of input.metadata)
    y =
      addDocumentText(
        doc,
        text,
        18,
        y,
        doc.internal.pageSize.getWidth() - 36,
        5,
      ) + 1;
  autoTable(doc, {
    startY: y + 4,
    margin: { top: 22, bottom: 23, left: 18, right: 18 },
    head: [input.columns],
    body: input.rows,
    ...documentTableStyles,
    styles: { ...documentTableStyles.styles, font },
    didDrawPage: () => {
      if (input.cancelled) {
        doc.setTextColor(185, 28, 28);
        doc.setFont(font, "bold");
        doc.setFontSize(13);
        doc.text("ANULADO - SIN EFECTO", 18, 14);
      }
    },
  });
  addDocumentFooter(
    doc,
    "Documento interno · " + input.branding.companyName.slice(0, 45),
    font,
  );
  return doc.output("blob");
}
export async function generateSupplierPaymentPdf(
  receipt: SupplierReceipt,
  branding: PdfBranding,
): Promise<Blob> {
  const money = (v: string) =>
      new Intl.NumberFormat(branding.locale, {
        style: "currency",
        currency: receipt.currencyCode,
      }).format(Number(v)),
    date = (v: string) =>
      new Date(v).toLocaleString(branding.locale, {
        timeZone: branding.timezone,
      });
  return tablePdf({
    title: "Comprobante interno de pago a proveedor",
    branding,
    cancelled: receipt.status === "CANCELLED",
    metadata: [
      `Comprobante: ${receipt.id}`,
      `Proveedor: ${receipt.supplierName}`,
      `Sucursal: ${receipt.branchName}`,
      `Estado: ${receipt.status === "CANCELLED" ? "ANULADO" : "REGISTRADO"} · Pago: ${date(receipt.paidAt)}`,
      `Monto: ${money(receipt.amount)} · Medio: ${receipt.paymentMethod?.name || "No registrado"}`,
      `Referencia: ${receipt.reference || "Sin referencia"} · Registró: ${receipt.registeredBy.name}`,
      ...(receipt.status === "CANCELLED"
        ? [
            `Anulado: ${receipt.cancelledAt ? date(receipt.cancelledAt) : "—"} · ${receipt.cancelledBy?.name || "—"}`,
            `Motivo: ${receipt.cancelReason || "—"}`,
          ]
        : []),
      ...(receipt.notes ? [`Notas: ${receipt.notes}`] : []),
      "Registro administrativo; no ejecuta transferencias bancarias, movimientos de caja ni asientos contables.",
    ],
    columns: ["Entrada de mercancía", "Importe aplicado"],
    rows: receipt.applications.map((a) => [a.reference, money(a.amount)]),
  });
}
export async function exportPayableStatement(
  dataset: PayablesExport,
  options: {
    format: "pdf" | "csv" | "xlsx";
    columns?: string[];
    fileName?: string;
  },
  branding: Branding,
  logoDataUrl?: string,
): Promise<Blob> {
  const prepared = preparePayableDocument(dataset, branding, options),
    spreadsheet = toSpreadsheetDocument(prepared, branding);
  if (options.format === "csv") {
    const csv = generateReportCsv(spreadsheet, "entries");
    const warnings = prepared.warnings.map(
      (text) =>
        '"' +
        payablesCsvCell(text).replace(/"/g, '""') +
        '"' +
        ',""'.repeat(prepared.columns.length - 1),
    );
    return new Blob([csv + warnings.join("\r\n") + "\r\n"], {
      type: "text/csv;charset=utf-8",
    });
  }
  if (options.format === "xlsx")
    return new Blob([await generateReportWorkbook(spreadsheet)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  return tablePdf({
    title: prepared.title,
    branding: { ...branding, logoDataUrl },
    metadata: [
      branding.scopeLabel,
      `Corte: ${new Date(prepared.asOf).toLocaleString(branding.locale, { timeZone: branding.timezone })} · ${branding.timezone}`,
      spreadsheet.period.label,
      `Saldo conocido: ${new Intl.NumberFormat(branding.locale, { style: "currency", currency: branding.currencyCode }).format(Number(prepared.totals.balance))}`,
      ...prepared.warnings,
    ],
    columns: prepared.columns.map(
      (c) =>
        c.label +
        (c.type === "money" ? " (" + branding.currencyCode + ")" : ""),
    ),
    rows: prepared.rows.map((r) =>
      prepared.columns.map((c) =>
        r[c.id] === null
          ? c.id === "balance"
            ? "Por revisar"
            : c.type === "date"
              ? "Sin fecha"
              : "—"
          : c.type === "money"
            ? Number(r[c.id]).toLocaleString(branding.locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : c.type === "date"
              ? new Date(
                  c.id === "dueDate"
                    ? String(r[c.id]) + "T12:00:00Z"
                    : String(r[c.id]),
                ).toLocaleDateString(branding.locale, {
                  timeZone: c.id === "dueDate" ? "UTC" : branding.timezone,
                })
              : String(r[c.id]),
      ),
    ),
  });
}
export { downloadReportBlob };

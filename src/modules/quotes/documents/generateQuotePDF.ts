import {documentUnitPrice} from '@/modules/inventory/units/public'
/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 */
import jsPDF from "jspdf";
import autoTable, { type jsPDFDocument } from "jspdf-autotable";
import type { Quote } from "@/services/quoteService";
import { num } from "@/services/quoteService";
import { serviceConditionText } from '@/services/serviceConditions';
import { formatMoney, formatDateTime } from "@/utils/formatters";
import { addJsPdfCompanyHeader, addDocumentFooter, addDocumentText, documentTableStyles, ensureDocumentSpace, PDF_DOCUMENT_COLORS } from "@/utils/pdfBranding";

const MARGIN = 18;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export interface QuotePDFOptions {
  companyName?: string;
  logoDataUrl?: string;
  locale?: string;
  currencyCode?: string;
}

type QuoteDocument = Pick<Quote, 'id' | 'reference' | 'created_at' | 'customer' | 'customerContact' | 'is_final_consumer' | 'customer_nit' | 'valid_until' | 'createdBy' | 'lines' | 'total' | 'notes' | 'payment_condition' | 'credit_days'>;
export function generateQuotePDF(quote: QuoteDocument, options: QuotePDFOptions = {}): void {
  const { companyName, logoDataUrl, locale = "es-GT", currencyCode = "GTQ" } = options;
  const doc = new jsPDF() as jsPDFDocument;
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);
  let y = addJsPdfCompanyHeader(doc, { companyName, logoDataUrl, pageWidth: PAGE_WIDTH, startY: 20 });

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_DOCUMENT_COLORS.navy);
  doc.text("COTIZACIÓN", PAGE_WIDTH / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const ref = quote.reference ?? quote.id.slice(0, 8);
  doc.text(`Ref. ${ref}`, PAGE_WIDTH / 2, y, { align: "center" });
  y += 6;
  doc.text(formatDateTime(quote.created_at, undefined, locale), PAGE_WIDTH / 2, y, { align: "center" });
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  y = addDocumentText(doc, quote.customer || quote.customerContact?.name || "—", MARGIN + 22, y, CONTENT_WIDTH - 22) + 2;
  y = ensureDocumentSpace(doc, y, 6);

  doc.setFont("helvetica", "bold");
  doc.text("ID fiscal:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  y = addDocumentText(doc,
    quote.is_final_consumer ? "Consumidor Final" : quote.customer_nit || quote.customerContact?.tax_id || "—",
    MARGIN + 22,
    y,
    CONTENT_WIDTH - 22
  ) + 2;

  y = addDocumentText(doc, quote.payment_condition === 'CREDIT' ? `Condición: crédito a ${quote.credit_days} días desde la venta` : 'Condición: al contado', MARGIN, y, CONTENT_WIDTH) + 2;
  if (quote.valid_until) {
    y = ensureDocumentSpace(doc, y, 6);
    doc.setFont("helvetica", "bold");
    doc.text("Válida hasta:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(formatDateTime(quote.valid_until, undefined, locale), MARGIN + 28, y);
    y += 6;
  }

  if (quote.createdBy?.name) {
    y = ensureDocumentSpace(doc, y, 6);
    doc.setFont("helvetica", "bold");
    doc.text("Elaborada por:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    y = addDocumentText(doc, quote.createdBy.name, MARGIN + 32, y, CONTENT_WIDTH - 32) + 4;
  } else {
    y += 4;
  }

  const tableBody = (quote.lines || []).map((line) => [
    [line.item_name ?? line.product?.name ?? line.product_id,serviceConditionText(line.service_schedule_snapshot)].filter(Boolean).join('\n'),
    `${line.qty} ${line.unit_label || ''}`.trim(),
    line.unit_metadata_version===2?`${currencyCode} ${documentUnitPrice(line,locale)}`:fmt(num(line.unit_price)),
    fmt(num(line.line_total)),
  ]);

  autoTable(doc, {
    startY: ensureDocumentSpace(doc, y, 18),
    head: [["Producto", "Cantidad", "P. unit.", "Subtotal"]],
    body: tableBody,
    theme: "grid",
    ...documentTableStyles,
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN, top: 20, bottom: 20 },
    tableWidth: CONTENT_WIDTH,
  });

  y = ensureDocumentSpace(doc, doc.lastAutoTable.finalY + 10, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_DOCUMENT_COLORS.navy);
  doc.setFillColor(...PDF_DOCUMENT_COLORS.total);
  doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 9, 'F');
  doc.text("Total:", MARGIN, y);
  doc.text(fmt(num(quote.total)), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 12;

  if (quote.notes?.trim()) {
    y = ensureDocumentSpace(doc, y, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notas:", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    y = addDocumentText(doc, quote.notes.trim(), MARGIN, y, CONTENT_WIDTH) + 4;
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_DOCUMENT_COLORS.muted);
  addDocumentText(doc,
    "Documento informativo, no es una factura. La disponibilidad del horario se confirma al agendar; los importes corresponden a esta cotización.",
    MARGIN,
    y,
    CONTENT_WIDTH
  );

  addDocumentFooter(doc, `Ref. ${ref}`);
  doc.save(`cotizacion-${ref}.pdf`);
}

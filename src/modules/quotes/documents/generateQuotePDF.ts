/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 */
import jsPDF from "jspdf";
import autoTable, { type jsPDFDocument } from "jspdf-autotable";
import type { Quote } from "@/services/quoteService";
import { num } from "@/services/quoteService";
import { formatMoney, formatDateTime } from "@/utils/formatters";
import { addJsPdfCompanyHeader } from "@/utils/pdfBranding";

const PDF_HEADER_COLOR: [number, number, number] = [217, 119, 6];
const MARGIN = 18;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export interface QuotePDFOptions {
  companyName?: string;
  logoDataUrl?: string;
  locale?: string;
  currencyCode?: string;
}

export function generateQuotePDF(quote: Quote, options: QuotePDFOptions = {}): void {
  const { companyName, logoDataUrl, locale = "es-GT", currencyCode = "GTQ" } = options;
  const doc = new jsPDF() as jsPDFDocument;
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);
  let y = addJsPdfCompanyHeader(doc, { companyName, logoDataUrl, pageWidth: PAGE_WIDTH, startY: 20 });

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
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
  doc.text(quote.customer || quote.customerContact?.name || "—", MARGIN + 22, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("ID fiscal:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    quote.is_final_consumer ? "Consumidor Final" : quote.customer_nit || quote.customerContact?.tax_id || "—",
    MARGIN + 22,
    y
  );
  y += 6;

  if (quote.valid_until) {
    doc.setFont("helvetica", "bold");
    doc.text("Válida hasta:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(formatDateTime(quote.valid_until, undefined, locale), MARGIN + 28, y);
    y += 6;
  }

  if (quote.createdBy?.name) {
    doc.setFont("helvetica", "bold");
    doc.text("Elaborada por:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(quote.createdBy.name, MARGIN + 32, y);
    y += 8;
  } else {
    y += 4;
  }

  const tableBody = (quote.lines || []).map((line) => [
    line.product?.name || line.product_id,
    String(line.qty),
    fmt(num(line.unit_price)),
    fmt(num(line.line_total)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Producto", "Cantidad", "P. unit.", "Subtotal"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: PDF_HEADER_COLOR, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_WIDTH,
  });

  y = doc.lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total:", MARGIN, y);
  doc.text(fmt(num(quote.total)), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 12;

  if (quote.notes?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notas:", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(quote.notes.trim(), CONTENT_WIDTH);
    doc.text(split, MARGIN, y);
    y += split.length * 4 + 4;
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Documento informativo. Los precios pueden variar según disponibilidad al confirmar el pedido.",
    MARGIN,
    285
  );

  doc.save(`cotizacion-${ref}.pdf`);
}

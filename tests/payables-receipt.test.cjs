const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs");
const receipt = {
  id: "abcd1234",
  status: "CANCELLED",
  companyId: "c",
  companyName: "Empresa de prueba",
  branchId: "b",
  branchName: "Sucursal central",
  supplierId: "s",
  supplierName:
    "Proveedor con un nombre comercial largo para validar el diseño multipágina",
  amount: "6000.00",
  currencyCode: "GTQ",
  paidAt: "2026-10-14T18:00:00Z",
  createdAt: "2026-10-14T18:00:00Z",
  paymentMethod: { id: 1, name: "Transferencia registrada" },
  reference: "QA transferencia",
  notes: "Registro administrativo. No se ejecutó una transferencia.",
  registeredBy: { id: "u", name: "Usuario QA" },
  cancelledAt: "2026-10-14T19:00:00Z",
  cancelledBy: { id: "u", name: "Usuario QA" },
  cancelReason: "Corrección por distribución equivocada",
  applications: Array.from({ length: 60 }, (_, i) => ({
    incomingId: "entrada-" + i,
    reference: "ENT-" + i,
    amount: "100.00",
    cancelledAt: "2026-10-14T19:00:00Z",
  })),
};
test("real receipt PDF is multipage and its cancelled status and last application survive rendering", async () => {
  const generator = loadReportModule(
    "../receivables/documents/payablesDocuments.ts",
    { "@/services/api": {} },
  );
  const previous = global.fetch;
  global.fetch = async (url) => {
    assert.match(url, /^\/fonts\//);
    const bytes = fs.readFileSync(path.join(__dirname, "../public", url));
    return {
      ok: true,
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    };
  };
  let pdf;
  try {
    pdf = await generator.generateSupplierPaymentPdf(receipt, {
      companyName: receipt.companyName,
      timezone: "America/Guatemala",
      locale: "es-GT",
      logoDataUrl: undefined,
    });
  } finally {
    global.fetch = previous;
  }
  assert.ok(pdf.size > 3000);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.match(bytes.toString("latin1"), /^%PDF/);
  const file = "/tmp/auna-payables-receipt.pdf";
  fs.writeFileSync(file, bytes);
  const { execFileSync } = require("node:child_process"),
    text = execFileSync("pdftotext", [file, "-"]).toString();
  assert.match(text, /ANULADO/);
  assert.match(text, /Corrección por distribución equivocada/);
  assert.match(text, /ENT-59/);
  assert.match(text, /Empresa de prueba/);
  assert.ok(!text.includes("FEL emitida"));
  assert.match(execFileSync("pdffonts", [file]).toString(), /CouponNoto.*yes/);
});
module.exports = { receipt };

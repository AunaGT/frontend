const test = require("node:test"),
  assert = require("node:assert/strict"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs");
const branding = {
  companyId: "company",
  companyName: "Empresa del cliente",
  companyLogoUrl: null,
  currencyCode: "GTQ",
  locale: "es-GT",
  timezone: "America/Guatemala",
  scopeLabel: "Sucursal central",
  branches: [{ id: "branch", name: "Central" }],
};
const items = Array.from({ length: 31 }, (_, i) => ({
  id: String(i),
  reference: "ENT-" + i,
  supplierName: i === 0 ? "=SUM(A1:A2)" : "Proveedor " + i,
  branchName: "Central",
  date: "2026-10-14T18:00:00Z",
  dueDate: "2026-11-01",
  total: "100.00",
  documentedPaid: "20.00",
  legacySettled: "0.00",
  balance: i === 30 ? null : "80.00",
  status: i === 30 ? "REVIEW" : "PARTIAL",
}));
test("export keeps the entire authorized dataset, real metadata, numeric money and incomplete balance warnings", () => {
  const api = loadReportModule(
      "../receivables/documents/payablesDocuments.ts",
      { "@/services/api": {} },
    ),
    data = {
      items,
      asOf: "2026-10-14T18:00:00Z",
      filters: { state: "ALL" },
      summary: { pending: "2400.00", reviewCount: 1, complete: false },
      branding,
    };
  const prepared = api.preparePayableDocument(data, branding, {}),
    sheet = api.toSpreadsheetDocument(prepared, branding);
  assert.equal(prepared.rows.length, 31);
  assert.equal(sheet.sections[0].rows[30].reference, "ENT-30");
  assert.equal(sheet.branding.companyName, "Empresa del cliente");
  assert.equal(sheet.scope.companyId, "company");
  assert.equal(sheet.scope.branches[0].id, "branch");
  assert.equal(sheet.sections[0].rows[0].balance, 80);
  assert.ok(sheet.notes.some((n) => /revisión|incomplet/i.test(n)));
  const { generateReportCsv } = loadReportModule(
    "documents/reportSpreadsheet.ts",
  );
  const csv = generateReportCsv(sheet, "entries");
  assert.match(csv, /'=SUM\(A1:A2\)/);
  assert.match(csv, /ENT-30/);
  assert.equal(api.payablesCsvCell("@proveedor"), "'@proveedor");
  assert.equal(api.payablesCsvCell("Proveedor normal"), "Proveedor normal");
});
test('real Excel keeps supplier formula-like names as text and all rows as typed financial data',async()=>{
 const api=loadReportModule('../receivables/documents/payablesDocuments.ts',{'@/services/api':{}})
 const dataset={items,asOf:'2026-10-14T18:00:00Z',filters:{state:'ALL'},summary:{pending:'2400.00',reviewCount:1,complete:false},branding}
 const blob=await api.exportPayableStatement(dataset,{format:'xlsx'},branding)
 const ExcelJS=require('exceljs'),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());const sheet=workbook.getWorksheet('Entradas de mercancía')
 assert.equal(sheet.getCell('B6').value,'=SUM(A1:A2)');assert.equal(sheet.getCell('I6').value,80);assert.equal(sheet.getCell('A36').value,'ENT-30');assert.equal(sheet.getCell('I36').value,null);assert.equal(workbook.getWorksheet('Resumen').getCell('A2').value,'Empresa del cliente')
})
module.exports = { branding, items };

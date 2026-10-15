const test = require("node:test"),
  assert = require("node:assert/strict");
const { loadReportModule } = require("./helpers/loadReportModule.cjs");
const { hookHarness } = require("./helpers/reportHookHarness.cjs");
function mount() {
  const h = hookHarness(),
    nodes = [],
    downloads = [];
  let allowed = true,
    release;
  const Preview = () => null;
  const receipt = {
    id: "receipt",
    status: "POSTED",
    supplierId: "supplier",
    supplierName: "Proveedor",
    companyName: "Empresa",
    branchName: "Central",
    currencyCode: "GTQ",
    amount: "50.00",
    paidAt: "2026-10-15T12:00:00Z",
    createdAt: "2026-10-15T12:00:00Z",
    registeredBy: { name: "Admin" },
    applications: [],
  };
  const Page = loadReportModule(
    "../receivables/pages/SupplierPaymentReceiptPage.tsx",
    {
      react: h.hooks,
      "react-router-dom": {
        useParams: () => ({ id: "receipt" }),
        useNavigate: () => () => {},
      },
      "@/components/layout/PageNavigation": { usePageTrail() {} },
      "@tanstack/react-query": { useQuery: () => ({ data: receipt }) },
      "@/hooks/useSystemSettings": {
        useSystemSettings: () => ({
          locale: "es-GT",
          timezone: "America/Guatemala",
        }),
      },
      "../hooks/usePayables": {
        useCarteraAccess: () => ({
          ready: true,
          payable: true,
          key: ["company", "branch"],
          tenant: { isConsolidated: false },
          hasPermission: (p) => (p === "merchandise.reports" ? allowed : true),
        }),
        useInvalidatePayables: () => async () => {},
      },
      "@/utils/pdfBranding": { resolvePdfLogoDataUrl: async () => undefined },
      "../api/payablesService": {},
      "../documents/payablesDocuments": {
        generateSupplierPaymentPdf: () =>
          new Promise((r) => {
            release = r;
          }),
        downloadReportBlob: (...args) => downloads.push(args),
      },
      "@/components/shared/pdf/PdfDocumentPreview": {
        PdfDocumentPreview: Preview,
      },
    },
    nodes,
  ).default;
  const render = () => {
    nodes.length = 0;
    h.render(() => Page());
  };
  render();
  return {
    render,
    nodes,
    Preview,
    downloads,
    allow: (v) => {
      allowed = v;
      render();
    },
    resolve: () => release(new Blob(["%PDF-qa"])),
    prepare: () =>
      nodes
        .find(
          (n) =>
            Array.isArray(n.props.children) &&
            n.props.children.includes("Vista previa / PDF"),
        )
        .props.onClick(),
  };
}
test("revoking reports permission discards an in-flight receipt PDF", async () => {
  const m = mount();
  m.prepare();
  await Promise.resolve();
  m.allow(false);
  m.resolve();
  await new Promise((r) => setImmediate(r));
  m.render();
  assert.equal(
    m.nodes.some((n) => n.type === m.Preview),
    false,
  );
  assert.equal(m.downloads.length, 0);
});
test("revoking reports permission removes a prepared preview and disables its stale download callback", async () => {
  const m = mount();
  m.prepare();
  await Promise.resolve();
  m.resolve();
  await new Promise((r) => setImmediate(r));
  m.render();
  const preview = m.nodes.find((n) => n.type === m.Preview);
  assert.ok(preview);
  m.allow(false);
  preview.props.onDownload();
  assert.equal(
    m.nodes.some((n) => n.type === m.Preview),
    false,
  );
  assert.equal(m.downloads.length, 0);
});

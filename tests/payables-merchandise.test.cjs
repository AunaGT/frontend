const test = require("node:test"),
  assert = require("node:assert/strict"),
  React = require("react"),
  { renderToStaticMarkup } = require("react-dom/server"),
  { MemoryRouter } = require("react-router-dom"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs");
test("merchandise separates historical settlement from payments and preserves cancelled history with a parent link", () => {
  const nodes = [],
    Panel = loadReportModule(
      "../merchandise/components/MerchandisePaymentsPanel.tsx",
      {
        "@/hooks/useAuthPermissions": {
          useAuthPermissions: () => ({ hasPermission: () => true }),
        },
        "@/context/useTenant": { useTenant: () => ({ isConsolidated: false }) },
        "@/hooks/useSystemSettings": {
          useSystemSettings: () => ({
            currencyCode: "GTQ",
            locale: "es-GT",
            timezone: "America/Guatemala",
          }),
        },
        "@/modules/receivables/hooks/usePayables": {
          useCarteraAccess: () => ({payable:true}),
          useInvalidatePayables: () => async () => {},
        },
        "../hooks/useIncomingMerchandise": {
          usePatchIncomingMerchandisePayment: () => ({
            isPending: false,
            mutateAsync: async () => {},
          }),
        },
        "@/services/api": {},
      },
      nodes,
    ).MerchandisePaymentsPanel;
  const record = {
    id: "m",
    source: "PURCHASE",
    totalValue: 100,
    amount_paid_total: 20,
    legacy_settled_amount: 80,
    amount_pending: 0,
    payment_revision: 1,
    payment_terms: [{id:1,name:'Crédito 30 días'}],
    payment_entries: [
      {
        id: "a",
        amount: 10,
        paid_at: "2026-10-14T18:00:00Z",
        cancelled_at: "2026-10-14T19:00:00Z",
        cancel_reason: "QA anulado",
        supplier_payment_id: "receipt",
      },
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(Panel, { record }),
    ),
  );
  assert.match(html, /Liquidación histórica/);
  assert.match(html, /Abonos documentados/);
  assert.match(html, /Anulado/);
  assert.match(html, /Ver comprobante/);
  assert.match(html, /<option value="1">Crédito 30 días<\/option>/);
  assert.ok(!html.includes("Eliminar abono"));
});

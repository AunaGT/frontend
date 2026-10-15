const test = require("node:test"),
  assert = require("node:assert/strict"),
  React = require("react"),
  { renderToStaticMarkup } = require("react-dom/server"),
  { MemoryRouter } = require("react-router-dom"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs");
test("supplier-only Cartera mounts no customer queries and consolidated list has no writable controls", () => {
  let receivableFetches = 0;
  const context = {
      ready: true,
      payable: true,
      receivable: false,
      key: ["c", "all"],
      hasPermission: () => true,
      tenant: { company: { id: "c" }, branch: null, isConsolidated: true },
    },
    query = {
      data: { items: [], page: 1, totalPages: 1, totalItems: 0 },
      isLoading: false,
      isFetching: false,
      isError: false,
    };
  const Page = loadReportModule("../receivables/pages/CarteraPage.tsx", {
    "./ReceivablesManagement": {
      default: () => {
        receivableFetches++;
        return null;
      },
    },
    "../hooks/usePayables": {
      useCarteraAccess: () => context,
      usePayables: () => ({
        context,
        summary: { ...query, data: undefined },
        entries: query,
        suppliers: query,
        aging: query,
      }),
    },
    "@tanstack/react-query": { useQuery: () => query },
    "@/hooks/useSystemSettings": {
      useSystemSettings: () => ({
        currencyCode: "GTQ",
        locale: "es-GT",
        timezone: "America/Guatemala",
      }),
    },
    "../api/receivablesService": {
      fetchReceivables() {
        receivableFetches++;
      },
      fetchAging() {
        receivableFetches++;
      },
    },
    "../components/PayablesExportButton": { PayablesExportButton: () => null },
    "@/services/api": { getApiBaseUrl: () => "" },
  }).default;
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/cartera?seccion=pagar"] },
      React.createElement(Page),
    ),
  );
  assert.equal(receivableFetches, 0);
  assert.match(html, /Vista consolidada/);
  assert.ok(!html.includes("Registrar pago"));
  assert.ok(!html.includes("Seleccionar entrada"));
  assert.doesNotMatch(html, /<h1[^>]*class="[^"]*text-3xl/);
});

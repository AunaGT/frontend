const test = require("node:test"),
  assert = require("node:assert/strict"),
  React = require("react");
const { renderToStaticMarkup } = require("react-dom/server"),
  { MemoryRouter } = require("react-router-dom");
const { loadReportModule } = require("./helpers/loadReportModule.cjs");
test("Merchandise can register supplier payments without enabling Cartera", () => {
  const tenant = {
    company: { id: "company" },
    branch: { id: "branch" },
    isConsolidated: false,
  };
  const auth = {
    permissionsReady: true,
    hasPermission: (p) => p.startsWith("merchandise."),
  };
  const modules = {
    isLoading: false,
    isError: false,
    enabledModuleCodes: new Set(["contacts", "inventory", "merchandise"]),
  };
  const common = {
    "@/context/useTenant": { useTenant: () => tenant },
    "@/context/useModules": { useModules: () => modules },
    "@/hooks/useAuthPermissions": { useAuthPermissions: () => auth },
    "@/services/api": {},
  };
  const access = loadReportModule(
    "../receivables/hooks/usePayables.ts",
    common,
  ).useCarteraAccess();
  assert.equal(access.payable, false);
  assert.equal(access.merchandisePayable, true);
  const entry = {
    id: "entry",
    supplierId: "supplier",
    supplierName: "Proveedor",
    branchId: "branch",
    branchName: "Central",
    balance: "100.00",
    revision: 0,
    date: "2026-10-15T12:00:00Z",
    dueDate: null,
  };
  const Page = loadReportModule(
    "../receivables/pages/SupplierPaymentPage.tsx",
    {
      ...common,
      "../hooks/usePayables": {
        useCarteraAccess: () => access,
        useInvalidatePayables: () => async () => {},
      },
      "@/context/useAuth": { useAuth: () => ({ user: { id: "user" } }) },
      "@/hooks/useSystemSettings": {
        useSystemSettings: () => ({
          currencyCode: "GTQ",
          timezone: "America/Guatemala",
          locale: "es-GT",
        }),
      },
      "@tanstack/react-query": {
        useQuery: ({ queryKey, enabled }) =>
          queryKey[0] === "payment-methods"
            ? { data: [] }
            : { data: enabled ? [entry] : undefined },
      },
    },
  ).default;
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/mercancia/pagos/nuevo?entradas=entry"] },
      React.createElement(Page, { source: "merchandise" }),
    ),
  );
  assert.match(html, /Monto total/);
  assert.doesNotMatch(html, /Selecciona una sucursal autorizada/);
});

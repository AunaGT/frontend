const test = require("node:test"),
  assert = require("node:assert/strict"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs");
test("payables API preserves filters and uses one parent payment endpoint", async () => {
  const calls = [],
    api = loadReportModule("../receivables/api/payablesService.ts", {
      "@/services/api": {
        apiFetch: async (...args) => {
          calls.push(args);
          return {};
        },
      },
    });
  await api.fetchPayableEntries({
    state: "OVERDUE",
    search: "A & B",
    page: 2,
    pageSize: 10,
  });
  assert.match(calls[0][0], /search=A\+%26\+B/);
  assert.match(calls[0][0], /page=2/);
  await api.createSupplierPayment({
    requestKey: "qa",
    applications: [{ incomingId: "a" }, { incomingId: "b" }],
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1][0], /payables\/payments$/);
  assert.equal(JSON.parse(calls[1][1].body).applications.length, 2);
});

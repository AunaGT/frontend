const test = require("node:test"),
  assert = require("node:assert/strict"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs");
test("selection persists across pages and rejects a different supplier or unknown balance", () => {
  const { togglePayableSelection } = loadReportModule(
    "../receivables/payableSelection.ts",
  );
  let rows = togglePayableSelection([], {
    id: "a",
    supplierId: "s",
    balance: "10.00",
    status: "PENDING",
    branchId: "b",
  });
  rows = togglePayableSelection(rows, {
    id: "b",
    supplierId: "s",
    balance: "20.00",
    status: "PENDING",
    branchId: "b",
  });
  assert.equal(rows.length, 2);
  assert.throws(
    () =>
      togglePayableSelection(rows, {
        id: "c",
        supplierId: "other",
        balance: "20.00",
        status: "PENDING",
        branchId: "b",
      }),
    /proveedor/,
  );
  assert.throws(
    () =>
      togglePayableSelection(rows, {
        id: "c",
        supplierId: "s",
        balance: null,
        status: "REVIEW",
        branchId: "b",
      }),
    /revisión/,
  );
  assert.equal(togglePayableSelection(rows, rows[0]).length, 1);
});

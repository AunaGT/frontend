const test = require("node:test"),
  assert = require("node:assert/strict"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs");
test("Cartera isolates sections by effective modules and permissions and waits for availability", () => {
  const { carteraAccess, permittedSelection } = loadReportModule(
    "../receivables/carteraAccess.ts",
  );
  assert.deepEqual(
    carteraAccess(
      new Set(["merchandise.details"]),
      new Set(["contacts", "inventory", "merchandise", "receivables"]),
    ),
    { receivable: false, payable: true },
  );
  assert.deepEqual(
    carteraAccess(
      new Set(["receivables.view"]),
      new Set(["contacts", "receivables"]),
    ),
    { receivable: false, payable: false },
  );
  assert.deepEqual(
    carteraAccess(new Set(["receivables.view", "merchandise.details"]), null),
    { receivable: false, payable: false },
  );
  const both = carteraAccess(
    new Set(["receivables.view", "merchandise.details"]),
    new Set(["sales", "contacts", "inventory", "merchandise", "receivables"]),
  );
  assert.deepEqual(both, { receivable: true, payable: true });
  assert.equal(permittedSelection("pagar", both), "pagar");
  assert.equal(
    permittedSelection("cobrar", { receivable: false, payable: true }),
    "pagar",
  );
  assert.equal(
    permittedSelection(null, { receivable: false, payable: false }),
    null,
  );
});

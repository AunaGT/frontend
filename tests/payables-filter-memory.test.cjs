const test = require("node:test"),
  assert = require("node:assert/strict"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs"),
  { hookHarness } = require("./helpers/reportHookHarness.cjs");
test("switching sections preserves each section filter without keeping its queries mounted", () => {
  const memory = new Map(),
    mount = (section) => {
      const h = hookHarness(),
        { useCarteraField } = loadReportModule(
          "../receivables/carteraViewState.tsx",
          { react: { ...h.hooks, useContext: () => memory } },
        );
      let state;
      const render = () =>
        (state = h.render(() => useCarteraField(section, "search", "")));
      render();
      return {
        render,
        get state() {
          return state;
        },
      };
    };
  const payable = mount("pagar");
  payable.state[1]("Proveedor QA");
  payable.render();
  assert.equal(mount("cobrar").state[0], "");
  assert.equal(mount("pagar").state[0], "Proveedor QA");
});

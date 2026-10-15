const test = require("node:test"),
  assert = require("node:assert/strict"),
  { loadReportModule } = require("./helpers/loadReportModule.cjs"),
  { hookHarness } = require("./helpers/reportHookHarness.cjs");
function mount(send, companyId = crypto.randomUUID()) {
  const h = hookHarness(),
    posts = [],
    entries = [
      {
        id: "a",
        supplierId: "s",
        balance: "60.00",
        revision: 0,
        date: "2026-01-01",
        dueDate: "2026-10-01",
      },
      {
        id: "b",
        supplierId: "s",
        balance: "40.00",
        revision: 0,
        date: "2026-01-02",
        dueDate: null,
      },
    ];
  let ctx = {
      companyId,
      branchId: "b",
      userId: "u",
      currencyCode: "GTQ",
      timezone: "America/Guatemala",
      entries,
    },
    state;
  const { useSupplierPaymentDraft } = loadReportModule(
    "../receivables/hooks/useSupplierPaymentDraft.ts",
    {
      react: h.hooks,
      "../api/payablesService": {
        createSupplierPayment: async (body) => {
          posts.push(body);
          return send(body);
        },
        fetchPayableSelection: async () => entries,
      },
      "@/services/api": {},
    },
  );
  const render = () => (state = h.render(() => useSupplierPaymentDraft(ctx)));
  render();
  return {
    render,
    get state() {
      return state;
    },
    posts,
    unmount: h.unmount,
    context: (value) => {
      ctx = { ...ctx, ...value };
      render();
    },
  };
}
function ready(m) {
  m.state.setAmount("100.00");
  m.render();
  m.state.setMethod("1");
  m.render();
  m.state.distribute();
  m.render();
  m.state.review();
  m.render();
  assert.equal(m.state.reviewing, true);
}
test("exact distribution, review and double click produce one grouped request", async () => {
  let release;
  const m = mount(() => new Promise((r) => (release = r)));
  ready(m);
  const promise = m.state.confirm();
  m.state.confirm();
  assert.equal(m.posts.length, 1);
  assert.deepEqual(
    m.posts[0].applications.map((a) => a.amount),
    ["60.00", "40.00"],
  );
  release({ id: "receipt" });
  await promise;
  m.render();
  assert.equal(m.state.receipt.id, "receipt");
});
test("ambiguous network result retries the identical key and blocks editing", async () => {
  let fail = true;
  const m = mount(async () => {
    if (fail) throw Error("offline");
    return { id: "receipt" };
  });
  ready(m);
  await m.state.confirm();
  m.render();
  assert.equal(m.state.ambiguous, true);
  m.state.setAmount("1.00");
  m.render();
  assert.equal(m.state.amount, "100.00");
  fail = false;
  await m.state.confirm();
  m.render();
  assert.equal(m.posts.length, 2);
  assert.equal(m.posts[0].requestKey, m.posts[1].requestKey);
  assert.deepEqual(m.posts[0], m.posts[1]);
});
test("409 preserves user amounts and removes confirmation until balances are reviewed", async () => {
  const m = mount(async () => {
    throw Object.assign(Error("El saldo cambió"), {
      status: 409,
      data: { code: "STALE_BALANCE" },
    });
  });
  ready(m);
  await m.state.confirm();
  m.render();
  assert.equal(m.state.amount, "100.00");
  assert.equal(m.state.reviewing, false);
  assert.equal(m.state.canConfirm, false);
  assert.match(m.state.error, /saldo cambió/i);
});
test("late response is discarded after changing branch", async () => {
  let release;
  const m = mount(() => new Promise((r) => (release = r)));
  ready(m);
  const pending = m.state.confirm();
  m.context({ branchId: "new" });
  release({ id: "old" });
  await pending;
  m.render();
  assert.equal(m.state.receipt, null);
  assert.equal(m.state.amount, "");
});
test("insufficient selection or mixed suppliers cannot be reviewed", () => {
  const m = mount(async () => ({}));
  m.state.setAmount("100.01");
  m.render();
  m.state.setMethod("1");
  m.render();
  m.state.distribute();
  m.render();
  m.state.review();
  m.render();
  assert.equal(m.state.reviewing, false);
  assert.match(m.state.error, /distrib|saldo|diferencia/i);
});
test("reopening an ambiguous payment restores the original request instead of allowing a second one", async () => {
  const values = new Map();
  global.sessionStorage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  const company = crypto.randomUUID(),
    first = mount(async () => {
      throw Error("offline");
    }, company);
  ready(first);
  await first.state.confirm();
  first.render();
  first.unmount();
  const next = mount(async () => ({ id: "recovered" }), company);
  next.render();
  assert.equal(next.state.ambiguous, true);
  assert.equal(next.state.amount, "100.00");
  await next.state.confirm();
  next.render();
  assert.equal(next.posts[0].requestKey, first.posts[0].requestKey);
  assert.equal(next.state.receipt.id, "recovered");
  delete global.sessionStorage;
});

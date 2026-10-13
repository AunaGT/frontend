const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const { assertPaginationOutside } = require('./pagination-assertions.cjs')
const root = path.resolve(__dirname, '../src')

// SSR does not run effects: no accounting writes or staging requests are made.
function render(name, props = {}, states = []) {
  const target = path.join(root, 'modules/accounting/components', name + '.tsx')
  const cache = new Map()
  let state = 0
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file, module)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    const native = mod.require.bind(mod)
    mod.require = dependency => {
      if (dependency.endsWith('.css')) return {}
      if (dependency === '@/hooks/use-toast') return { useToast: () => ({ toast() {} }) }
      if (dependency === '@/context/useTenant') return { useTenant: () => ({ branches: [] }) }
      if (dependency === '@/hooks/useAuthPermissions') return { useAuthPermissions: () => ({ hasPermission: () => false }) }
      if (dependency === '@/services/api') return { apiFetch() { throw Error('Unexpected request') }, getApiBaseUrl: () => '' }
      if (dependency === 'react' && file === target) return { ...React, useState: initial => React.useState(state < states.length ? states[state++] : initial) }
      const local = dependency.startsWith('@/') ? path.join(root, dependency.slice(2)) : dependency.startsWith('.') ? path.resolve(path.dirname(file), dependency) : null
      if (!local) return native(dependency)
      if (local === path.join(root, 'services/api')) return { apiFetch() { throw Error('Unexpected request') }, getApiBaseUrl: () => '' }
      return load(['', '.tsx', '.ts', '.js', '/index.tsx', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  const exports = load(target)
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(exports[name] || exports.default, props)))
}

const account = { id: 1, code: '1101', name: 'Caja', type: 'ASSET', parent_id: null, is_group: false, active: true, system: true }
const entry = { id: 'entry-a', entry_number: 'A-001', date: '2026-10-01', description: 'Apertura de prueba', source_type: 'MANUAL', source_id: null, branch_id: null, branch: null, reversal_of_id: null, created_at: '2026-10-01', reversals: [], lines: [{ id: 1, account_id: 1, debit: '25.00', credit: '0', description: null, account: { code: '1101', name: 'Caja' } }] }

test('accounting navigation preserves seven panels with compact accessible tabs', () => {
  const html = render('AccountingManagement')
  assert.match(html, /accounting-page/)
  assert.match(html, /class="sr-only">Contabilidad<\/h1>/)
  assert.equal((html.match(/role="tab"/g) || []).length, 7)
  assert.match(html, /bg-brand-orange/)
})

test('accounts paginate outside their only result frame and summarize the complete catalog', () => {
  const accounts = Array.from({ length: 31 }, (_, i) => ({ ...account, id: i + 1, code: String(1101 + i), name: `Cuenta ${i + 1}`, active: i !== 30 }))
  const html = render('AccountsTab', { accounts, canManage: true, onChanged() {} })
  assert.match(html, /metric-strip/)
  assert.ok(html.indexOf('metric-strip') < html.indexOf('compact-filter-toolbar'))
  assert.match(html, />31<\/strong>/)
  assert.match(html, /Cuenta 25/)
  assert.doesNotMatch(html, /Cuenta 26<\/td>/)
  assertPaginationOutside(html)
  const readonly = render('AccountsTab', { accounts: [account], canManage: false, onChanged() {} })
  assert.doesNotMatch(readonly, /Nueva cuenta|>Editar<|>Desactivar</)
  const filtered = render('AccountsTab', { accounts, canManage: false, onChanged() {} }, [false, null, false, '', '', '', '', false, '', 'Cuenta 31', 'all', 'all', 1])
  assert.match(filtered, /Cuenta 31/)
  assert.doesNotMatch(filtered, /Cuenta 30<\/td>/)
  assert.match(filtered, />1<\/strong>/)
  assert.match(filtered, />0<\/strong>/)
})

test('journal renders real entries with keyboard expansion and pagination outside the table', () => {
  const html = render('JournalTab', { accounts: [account], canCreate: true }, [[entry], false, 1, 2, 31, '', '', '', '', null, false, false, false, false, false])
  assert.match(html, /A-001/)
  assert.match(html, /auna-data-table-shell/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-label="Ver líneas del asiento A-001"/)
  assert.match(html, /compact-filter-actions/)
  assertPaginationOutside(html)
  const expanded = render('JournalTab', { accounts: [account], canCreate: true }, [[entry], false, 1, 1, 1, '', '', '', '', 'entry-a', false, false, false, false, false])
  assert.match(expanded, /aria-expanded="true"/)
  assert.match(expanded, /aria-label="Líneas del asiento A-001"/)
  assert.match(expanded, /1101 — Caja/)
  assert.match(expanded, /25\.00/)
  const readonly = render('JournalTab', { accounts: [], canCreate: false })
  assert.doesNotMatch(readonly, /Nuevo asiento|Registrar gasto|Contabilizar pendientes/)
})

for (const [source, label] of [['PAYROLL', 'Nómina'], ['PAYROLL_PAYMENT', 'Pago de nómina'], ['PAYROLL_ADVANCE', 'Anticipo de nómina']]) {
  test(`journal identifies ${source} in the entry and applied origin filter`, () => {
    const html = render('JournalTab', { accounts: [account], canCreate: false }, [[{ ...entry, source_type: source }], false, 1, 1, 1, '', '', source, '', null, false, false, false, false, false])
    assert.ok(html.includes(`>${label}</div>`), 'The entry has a readable origin badge')
    assert.ok(html.includes(`aria-label="Quitar Origen: ${label}"`), 'The applied filter uses the same origin label')
    assert.match(html, /A-001/)
    assert.match(html, /25\.00/)
  })
}

test('ledger and trial balance keep actual monetary values in flat summaries above filters', () => {
  const data = { account, initialBalance: 100, movements: [], totals: { debit: 25, credit: 0 }, finalBalance: 125 }
  const ledger = render('LedgerTab', { accounts: [account] }, ['1', '', '', data, false, false])
  assert.match(ledger, /auna-data-table-shell/)
  assert.match(ledger, /metric-strip/)
  assert.match(ledger, /125\.00/)
  assert.ok(ledger.indexOf('metric-strip') < ledger.indexOf('compact-filter-toolbar'))
  const balance = render('TrialBalanceTab', {}, ['', '', { rows: [], totals: { debit: 0, credit: 0, initialDebit: 0, initialCredit: 0, finalDebit: 0, finalCredit: 0 } }, false, false])
  assert.match(balance, /metric-strip/)
  assert.match(balance, /Cuadrada/)
  assert.match(balance, /0\.00/)
})

test('tax summaries precede the annual selector and keep regime-specific report columns', () => {
  for (const regime of ['GENERAL', 'PEQUENO']) {
    const totals = { netSales: 1000, ivaDebit: 120, ivaCredit: 0, pequenoTax: 50, toPay: regime === 'GENERAL' ? 120 : 50 }
    const html = render('TaxesTab', {}, [2026, { year: 2026, regime, ivaRate: 0.12, pequenoRate: 0.05, totals, months: [{ month: 1, ...totals }] }, false, false])
    assert.match(html, /metric-strip/)
    assert.ok(html.indexOf('metric-strip') < html.indexOf('auna-page-toolbar'))
    assert.match(html, /auna-data-table-shell/)
    assert.match(html, regime === 'GENERAL' ? /IVA crédito \(compras\)/ : /IVA 5% sobre ventas/)
  }
})

test('settings separate tasks into accessible panels without dropping opening or closing controls', () => {
  const html = render('SettingsTab', { accounts: [account], canManage: true })
  assert.match(html, /accounting-settings-tabs/)
  assert.equal((html.match(/role="tab"/g) || []).length, 4)
  assert.match(html, /Guardar tasas/)
  assert.match(html, /Guardar configuración/)
  assert.match(html, /Crear asiento de apertura/)
  assert.match(html, /Cerrar ejercicio/)
  assert.equal((html.match(/title="Cerrar"/g) || []).length, 12)
  const panels = [...html.matchAll(/<div[^>]*role="tabpanel"[^>]*>/g)].map(m => m[0])
  assert.equal(panels.length, 4)
  assert.equal(panels.filter(p => /hidden=""/.test(p)).length, 3, 'Only the selected task should occupy space; hidden drafts stay mounted')
  assert.match(render('SettingsTab', { accounts: [], canManage: false }), /No tienes permiso/)
})

test('financial statements summarize existing data without nesting another result frame', () => {
  const pnl = { income: [], costs: [], expenses: [], totalIncome: 25, totalCosts: 0, totalExpenses: 0, grossProfit: 25, netIncome: 25 }
  const bs = { asOf: '2026-10-07', assets: [], liabilities: [], equity: [], currentResult: 25, totalAssets: 100, totalLiabilities: 50, totalEquity: 50, balanced: true }
  const html = render('StatementsTab', {}, ['', null, '2026-01-01', '2026-10-07', '2026-10-07', false, pnl, bs, false, false])
  assert.match(html, /metric-strip/)
  assert.ok(html.indexOf('metric-strip') < html.indexOf('compact-filter-toolbar'))
  assert.match(html, /Estado de Resultados/)
  assert.match(html, /Balance General/)
  assert.match(html, /auna-surface/)
  assert.match(html, /100\.00/)
  assert.match(html, /25\.00/)
  assert.match(html, /no se filtra por sucursal/)
})

test('failed reports expose a retry without making the user change the queried filters', () => {
  for (const [name, props, states] of [
    ['LedgerTab', { accounts: [account] }, ['1', '', '', null, false, false, true]],
    ['TrialBalanceTab', {}, ['', '', null, false, false, true]],
    ['TaxesTab', {}, [2026, null, false, false]],
    ['StatementsTab', {}, ['', null, '', '', '', false, null, null, false, false]],
  ]) {
    const html = render(name, props, states)
    assert.match(html, /role="alert"/)
    assert.match(html, /Reintentar/)
  }
})

test('new account filters have stable accessible names', () => {
  const file = path.join(root, 'modules/accounting/components/AccountsTab.tsx')
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = []
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'SelectTrigger') {
      const label = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'aria-label')
      if (label && label.initializer && ts.isStringLiteral(label.initializer)) names.push(label.initializer.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(names.includes('Tipo de cuenta'))
  assert.ok(names.includes('Estado'))
})

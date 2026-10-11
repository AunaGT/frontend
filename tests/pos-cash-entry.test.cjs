const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const runtime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../src')
const register = { id: 'r-1', name: 'Caja principal', code: 'PRIN', is_default: true, active: true }
const session = { id: 's-1', opened_by_id: 'u-1', opened_by_name: 'Ana', opening_float: 50, opened_at: '2026-10-08T12:00:00Z' }

function render(component, { registers = [register], refreshedRegisters = registers, user = { id: 'u-1', cash_register_id: 'r-1', role: { name: 'Vendedor' } }, all = false, state = {}, props = {}, failure = null } = {}) {
  const file = path.join(root, `modules/sales/${component}.tsx`)
  const source = fs.readFileSync(file, 'utf8')
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const fn = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === component)
  const names = fn.body.statements.flatMap(n => ts.isVariableStatement(n) ? n.declarationList.declarations.filter(d => ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'useState').map(d => d.name.elements[0].name.text) : [])
  const values = { registers, loading: false, ...state }, nodes = [], writes = [], selections = [], updates = [], cache = new Map()
  let index = 0, opened = 0, back = 0
  const overrides = {
    '@/context/useAuth': { useAuth: () => ({ user }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => all }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
    '@/services/cashSessionsService': { listCashRegisters: async () => refreshedRegisters, openCashSession: async payload => { writes.push(payload); if (failure) throw Error(failure) } },
  }
  function load(target) {
    if (cache.has(target)) return cache.get(target).exports
    const mod = new Module(target, module)
    cache.set(target, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(target))
    const native = mod.require.bind(mod)
    mod.require = name => {
      if (name.endsWith('.css')) return {}
      if (name === 'react' && target === file) return { ...React, useState: initial => { const name = names[index++]; return [name in values ? values[name] : initial, value => updates.push({ name, value })] } }
      if (name === 'react/jsx-runtime' && target === file) return { ...runtime, jsx: (type, props, key) => { nodes.push({ type, props }); return runtime.jsx(type, props, key) }, jsxs: (type, props, key) => { nodes.push({ type, props }); return runtime.jsxs(type, props, key) } }
      if (name in overrides) return overrides[name]
      const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(target), name) : null
      if (!local) return native(name)
      return load(['', '.tsx', '.ts', '.js', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(target, 'utf8').replaceAll('import.meta.env', '({})'), { fileName: target, compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, target)
    return mod.exports
  }
  const Component = load(file)[component]
  const html = renderToStaticMarkup(React.createElement(Component, { registerId: register.id, registerName: register.name, onSelect: id => selections.push(id), onOpened: () => { opened++ }, onBack: () => { back++ }, ...props }))
  return { html, nodes, writes, selections, updates, get opened() { return opened }, get back() { return back } }
}

test('cash picker limits sellers to their assigned register, with default fallback', () => {
  const registers = [register, { ...register, id: 'r-2', name: 'Caja secundaria', is_default: false }]
  assert.ok(!render('CashRegisterPicker', { registers }).html.includes('Caja secundaria'))
  assert.ok(render('CashRegisterPicker', { registers, all: true }).html.includes('Caja secundaria'))
  const view = render('CashRegisterPicker', { registers, user: { id: 'u-1' } })
  assert.ok(view.html.includes('Caja principal'))
  assert.ok(!view.html.includes('Caja secundaria'))
})

test('cash picker distinguishes opening and continuing with accessible orange actions', () => {
  const closed = render('CashRegisterPicker')
  const open = render('CashRegisterPicker', { registers: [{ ...register, open_session: session }] })
  const action = closed.nodes.find(n => n.props['aria-label'] === 'Abrir caja Caja principal')
  assert.ok(action, 'register action must identify its caja')
  assert.ok(closed.html.includes('auna-form-action-primary'))
  action.props.onClick()
  assert.deepEqual(closed.selections, ['r-1'])
  const resume = open.nodes.find(n => n.props['aria-label'] === 'Continuar venta en Caja principal')
  assert.ok(resume && !resume.props.disabled)
  assert.ok(open.html.includes('Ana'))
})

test('cash picker cannot offer continuing another seller’s turn, but preserves admin access', () => {
  const registers = [{ ...register, open_session: { ...session, opened_by_id: 'other' } }]
  const seller = render('CashRegisterPicker', { registers, all: true })
  assert.ok(seller.html.includes('Turno de otro usuario'))
  assert.ok(seller.nodes.some(n => n.props.disabled && n.props.children === 'Caja en uso'))
  const admin = render('CashRegisterPicker', { registers, all: true, user: { id: 'u-1', role: { name: 'admin' } } })
  assert.ok(admin.nodes.some(n => n.props['aria-label'] === 'Continuar venta en Caja principal' && !n.props.disabled))
})

test('cash entry preserves empty, loading and retry states', () => {
  assert.ok(render('CashRegisterPicker', { registers: [] }).html.includes('No hay cajas activas'))
  assert.ok(render('CashRegisterPicker', { registers: [], state: { loading: true } }).html.includes('Cargando cajas'))
  assert.ok(render('CashRegisterPicker', { state: { error: 'Sin conexión' } }).html.includes('Reintentar'))
})

test('cash picker can refresh an occupied register after its turn closes elsewhere', async () => {
  const view = render('CashRegisterPicker', { registers: [{ ...register, open_session: { ...session, opened_by_id: 'other' } }], refreshedRegisters: [register] })
  const refresh = view.nodes.find(n => n.props['aria-label'] === 'Actualizar cajas')
  assert.ok(refresh, 'occupied register needs a refresh action without leaving the page')
  await refresh.props.onClick()
  assert.ok(view.updates.some(u => u.name === 'registers' && !u.value[0].open_session))
  assert.ok(render('CashRegisterPicker').html.includes('Abrir caja'))
})

test('opening uses an in-page form and links validation to the global input', () => {
  const view = render('OpenCashRegisterPrompt', { state: { submitError: 'Fondo inválido' } })
  assert.ok(view.html.includes('aria-label="Apertura de caja"'))
  assert.ok(!view.html.includes('fixed inset-0'))
  assert.ok(view.html.includes('aria-describedby="open-cash-help open-cash-error"'))
  assert.ok(view.html.includes('aria-invalid="true"'))
  const back = view.nodes.find(n => n.props.children === 'Cambiar de caja')
  back.props.onClick()
  assert.equal(view.back, 1)
})

test('opening refuses invalid funds, accepts zero, and notifies parent only after success', async () => {
  for (const value of ['-1', '']) {
    const view = render('OpenCashRegisterPrompt', { state: { openingFloat: value } })
    await view.nodes.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.equal(view.writes.length, 0)
    assert.ok(view.updates.some(u => u.name === 'submitError' && u.value.includes('válido')))
  }
  for (const value of ['0', '25.50']) {
    const view = render('OpenCashRegisterPrompt', { state: { openingFloat: value } })
    await view.nodes.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.deepEqual(view.writes, [{ opening_float: Number(value), cash_register_id: 'r-1' }])
    assert.equal(view.opened, 1)
  }
  const failed = render('OpenCashRegisterPrompt', { failure: 'Caja ocupada' })
  await failed.nodes.find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(failed.opened, 0)
  assert.ok(failed.updates.some(u => u.name === 'submitError' && u.value === 'Caja ocupada'))
})

const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

function renderLauncher({ search = '', pathname = '/inventario/qa-product', enabled = new Set(['sales', 'inventory', 'contacts', 'reports', 'alerts']), permissions = [], admin = true, loading = false, error = false, open = true, alerts = 150 } = {}) {
  const oldWindow = global.window, oldStorage = global.localStorage
  global.window = {}
  global.localStorage = { getItem: () => JSON.stringify({ role: { name: admin ? 'admin' : 'staff' }, permissions }) }
  const nodes = [], navigations = [], changes = [], closes = [], retries = [], focusCalls = []
  let stateIndex = 0
  try {
    const { AppLauncher } = loadReportModule('../../components/layout/AppLauncher.tsx', {
      react: { ...React, useState: initial => { const [value, setValue] = React.useState(stateIndex++ === 0 ? search : initial); return [value, next => { changes.push(next); setValue(next) }] } },
      'react-router-dom': { ...require('react-router-dom'), useNavigate: () => path => navigations.push(path), useLocation: () => ({ pathname }) },
      // Portal placement and scroll locking require a DOM; keep Radix content/title/focus context real.
      '@radix-ui/react-dialog': { ...require('@radix-ui/react-dialog'), Portal: ({ children }) => children, Overlay: () => null },
      '@/context/useModules': { useModules: () => ({ enabledModuleCodes: enabled, isLoading: loading, isError: error, refetch: () => retries.push('retry') }) },
      '@/hooks/useActiveAlertsCount': { useActiveAlertsCount: () => ({ data: alerts }) },
    }, nodes)
    return { html: renderToStaticMarkup(React.createElement(AppLauncher, { open, onOpenChange: value => closes.push(value), triggerRef: { current: { focus: () => focusCalls.push('trigger') } } })), nodes, navigations, changes, closes, retries, focusCalls }
  } finally {
    if (oldWindow === undefined) delete global.window; else global.window = oldWindow
    if (oldStorage === undefined) delete global.localStorage; else global.localStorage = oldStorage
  }
}

test('the launcher uses horizontal shared cards and original icons in a labelled Auna dialog', () => {
  const { html, nodes } = renderLauncher()
  assert.match(html, /role="dialog"/)
  assert.match(html, /Menú de módulos/)
  assert.match(html, /auna-surface/)
  assert.match(html, /src="\/icons\/modules\/auna\/inventario.svg"/)
  assert.match(html, /Productos, stock y almacenes/)
  assert.doesNotMatch(html, /bg-gradient|bg-white|line-clamp|hover:-translate/)
  assert.equal((html.match(/<button[^>]*aria-label="Abrir [^"]+"/g) || []).length, 5)
  const input = nodes.find(node => node.props.id === 'launcher-module-search' && node.props.onChange)
  assert.ok(input)
  assert.equal(input.props.autoFocus, true)
  const dialog = nodes.find(node => node.type?.displayName === 'DialogContent')
  assert.equal(dialog.props.variant, 'auna')
  assert.match(dialog.props.className, /overflow-hidden/)
  assert.match(html, /role="region"[^>]*aria-label="Módulos disponibles"/)
})

test('search trims whitespace and matches the real module description; clearing leaves the dialog open', () => {
  const result = renderLauncher({ search: '  productos  ' })
  assert.match(result.html, /Abrir Inventario/)
  assert.equal((result.html.match(/<button[^>]*aria-label="Abrir [^"]+"/g) || []).length, 1)
  result.nodes.find(node => node.props['aria-label'] === 'Limpiar búsqueda').props.onClick()
  assert.deepEqual(result.changes, [''])
  assert.deepEqual(result.closes, [])
  const empty = renderLauncher({ search: 'inexistente' })
  assert.match(empty.html, /No encontramos módulos/)
  assert.doesNotMatch(empty.html, /aria-label="Abrir /)
})

test('a nested or legacy route marks its module current without confusing sibling prefixes', () => {
  for (const pathname of ['/inventario/qa-product', '/productos/qa-product']) {
    const html = renderLauncher({ pathname }).html
    assert.match(html.match(/<button[^>]*aria-label="Abrir Inventario"[^>]*>/)?.[0], /aria-current="true"/)
  }
  assert.doesNotMatch(renderLauncher({ pathname: '/inventariado' }).html.match(/<button[^>]*aria-label="Abrir Inventario"[^>]*>/)?.[0], /aria-current/)
})

test('module navigation and dismissing the launcher clear the query without changing destinations', () => {
  const result = renderLauncher({ search: 'inventario' })
  result.nodes.find(node => node.props['aria-label'] === 'Abrir Inventario').props.onClick()
  assert.deepEqual(result.navigations, ['/inventario'])
  assert.deepEqual(result.closes, [false])
  assert.deepEqual(result.changes, [''])
  const dismissed = renderLauncher({ search: 'ventas' })
  const dialog = dismissed.nodes.find(node => node.props.open === true && node.props.onOpenChange)
  dialog.props.onOpenChange(false)
  assert.deepEqual(dismissed.closes, [false])
  assert.deepEqual(dismissed.changes, [''])
})

test('permission and activation checks apply before listing modules or exposing alert counts', () => {
  const restricted = renderLauncher({ admin: false, permissions: ['products.view'], enabled: new Set(['inventory', 'sales', 'alerts']) })
  assert.match(restricted.html, /Abrir Inventario/)
  assert.doesNotMatch(restricted.html, /Abrir Ventas|Abrir Alertas|150 alertas activas/)
  assert.doesNotMatch(renderLauncher({ enabled: new Set(['sales']) }).html, /Abrir Inventario/)
  assert.match(renderLauncher({ admin: false }).html, /No hay módulos disponibles/)
})

test('module loading and error states never expose the unready or cached catalogue and can retry', () => {
  for (const options of [{ loading: true }, { enabled: null }]) {
    const result = renderLauncher(options)
    assert.match(result.html, /Cargando módulos/)
    assert.doesNotMatch(result.html, /aria-label="Abrir /)
  }
  const failed = renderLauncher({ error: true })
  assert.match(failed.html, /role="alert"/)
  assert.doesNotMatch(failed.html, /aria-label="Abrir /)
  failed.nodes.find(node => node.props.children === 'Reintentar').props.onClick()
  assert.deepEqual(failed.retries, ['retry'])
  assert.equal(renderLauncher({ open: false }).html, '')
})

test('alert descriptions use launcher-scoped IDs and the uncapped count, avoiding collisions with Home', () => {
  const html = renderLauncher().html
  const alert = html.match(/<button[^>]*aria-label="Abrir Alertas"[^>]*>/)?.[0]
  assert.match(alert, /aria-describedby="launcher-module-purpose-alerts launcher-module-count-alerts"/)
  assert.match(html, /id="launcher-module-count-alerts" aria-label="150 alertas activas"/)
  assert.match(html, /99\+/)
  assert.doesNotMatch(html, /id="home-module-/)
  assert.doesNotMatch(renderLauncher({ alerts: 0 }).html, /launcher-module-count-alerts/)
})

test('closing the modal restores focus to the existing navbar trigger', () => {
  const result = renderLauncher()
  const dialog = result.nodes.find(node => node.type?.displayName === 'DialogContent')
  let prevented = false
  assert.equal(typeof dialog.props.onCloseAutoFocus, 'function')
  dialog.props.onCloseAutoFocus({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.deepEqual(result.focusCalls, ['trigger'])
})

test('hover keeps module labels in the foreground color over the raised light surface', () => {
  const button = renderLauncher().html.match(/<button[^>]*aria-label="Abrir Inventario"[^>]*>/)?.[0]
  assert.match(button, /hover:text-foreground/)
  assert.doesNotMatch(button, /hover:text-accent-foreground/)
})

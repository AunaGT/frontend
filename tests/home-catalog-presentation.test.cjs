const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

function renderHome({ search = '', enabled = new Set(['sales', 'inventory', 'contacts', 'reports', 'alerts']), permissions = [], admin = true, loading = false, error = false, alerts = 8 } = {}) {
  const oldWindow = global.window, oldStorage = global.localStorage
  global.window = {}
  global.localStorage = { getItem: () => JSON.stringify({ name: 'Persona QA', role: { name: admin ? 'admin' : 'staff' }, permissions }) }
  const nodes = [], navigations = [], changes = [], retries = []
  let stateIndex = 0
  try {
    const Page = loadReportModule('../../pages/HomePage.tsx', {
      react: { ...React, useState: initial => { const [value, setValue] = React.useState(stateIndex++ === 0 ? search : initial); return [value, next => { changes.push(next); setValue(next) }] } },
      'react-router-dom': { ...require('react-router-dom'), useNavigate: () => path => navigations.push(path) },
      '@/context/useModules': { useModules: () => ({ enabledModuleCodes: enabled, isLoading: loading, isError: error, refetch: () => retries.push('retry') }) },
      '@/hooks/useSystemSettings': { useSystemSettings: () => ({ companyName: 'Empresa QA' }) },
      '@/hooks/useActiveAlertsCount': { useActiveAlertsCount: () => ({ data: alerts }) },
    }, nodes).default
    return { html: renderToStaticMarkup(React.createElement(Page)), nodes, navigations, changes, retries }
  } finally {
    if (oldWindow === undefined) delete global.window; else global.window = oldWindow
    if (oldStorage === undefined) delete global.localStorage; else global.localStorage = oldStorage
  }
}

test('home presents one compact operational catalogue with original SVGs and a bounded toolbar search', () => {
  const { html, nodes } = renderHome()
  assert.match(html, /Tu espacio de trabajo/)
  assert.match(html, /aria-label="Fecha actual"/)
  assert.match(html, /dateTime="\d{4}-\d{2}-\d{2}"/i)
  assert.match(html, /home-module-card auna-surface/)
  assert.match(html, /src="\/icons\/modules\/auna\/ventas.svg"/)
  assert.match(html, /src="\/icons\/modules\/auna\/inventario.svg"/)
  assert.match(html, /src="\/icons\/modules\/auna\/proveedores.svg"/)
  assert.equal((html.match(/<button[^>]*aria-label="Abrir [^"]+"/g) || []).length, 5)
  assert.doesNotMatch(html, /bg-gradient|shadow-lg|role="tablist"|<aside|Calendario|Todo está al día/)
  const toolbar = nodes.find(node => node.props.className?.includes('home-toolbar'))
  const search = nodes.find(node => node.props.className?.includes('home-search'))
  assert.ok(toolbar)
  assert.match(search.props.className, /max-w-\[420px\]/)
  assert.ok(html.indexOf('Acciones rápidas') < html.indexOf('Buscar módulo'))
  assert.ok(html.indexOf('Buscar módulo') < html.indexOf('home-module-card'))
})

test('catalogue and quick actions navigate through the same real module routes', () => {
  const result = renderHome()
  result.nodes.find(node => node.props['aria-label'] === 'Abrir Inventario').props.onClick()
  const shortcuts = result.nodes.find(node => node.props['aria-label'] === 'Acciones rápidas')
  assert.ok(shortcuts)
  const quickInventory = result.nodes.find(node => node.props['aria-label'] === 'Acceso rápido a Inventario')
  quickInventory.props.onClick()
  assert.deepEqual(result.navigations, ['/inventario', '/inventario'])
  assert.match(result.html, /8 alertas activas/)
})

test('the alert card associates its actual count with the accessible description even when its badge is capped', () => {
  for (const count of [8, 150]) {
    const { html } = renderHome({ alerts: count })
    const button = html.match(/<button[^>]*aria-label="Abrir Alertas"[^>]*>/)?.[0]
    assert.match(button, /aria-describedby="home-module-purpose-alerts home-module-count-alerts"/)
    assert.match(html, new RegExp(`id="home-module-count-alerts" aria-label="${count} alertas activas"`))
  }
  const { html } = renderHome({ alerts: 0 })
  assert.doesNotMatch(html, /home-module-count-alerts/)
})

test('search filters the authorized catalogue by description and clearing restores the existing query state', () => {
  const result = renderHome({ search: 'productos' })
  assert.equal((result.html.match(/<button[^>]*aria-label="Abrir [^"]+"/g) || []).length, 1)
  assert.match(result.html, /Abrir Inventario/)
  result.nodes.find(node => node.props['aria-label'] === 'Limpiar búsqueda').props.onClick()
  assert.deepEqual(result.changes, [''])
  const empty = renderHome({ search: 'inexistente' })
  assert.match(empty.html, /Busquemos por otro lado/)
  assert.doesNotMatch(empty.html, /home-module-card/)
})

test('disabled or unauthorized modules stay absent from catalogue, shortcuts and alert badges', () => {
  const result = renderHome({ admin: false, permissions: ['products.view'], enabled: new Set(['inventory', 'sales', 'alerts']) })
  assert.match(result.html, /Abrir Inventario/)
  assert.doesNotMatch(result.html, /Abrir Ventas|Acceso rápido a Ventas|Abrir Alertas|8 alertas activas/)
  assert.equal((result.html.match(/<button[^>]*aria-label="Abrir [^"]+"/g) || []).length, 1)
  assert.doesNotMatch(renderHome({ enabled: new Set(['sales']) }).html, /Abrir Inventario|Acceso rápido a Inventario/)
  const denied = renderHome({ admin: false })
  assert.match(denied.html, /Tu espacio de trabajo está por abrirse/)
  assert.doesNotMatch(denied.html, /Abrir |Acceso rápido a /)
})

test('loading and failed module requests do not expose cached quick navigation and errors can retry', () => {
  const loading = renderHome({ loading: true })
  assert.match(loading.html, /Preparando Inicio/)
  assert.doesNotMatch(loading.html, /Abrir |Acceso rápido a |módulos disponibles/)
  const failed = renderHome({ error: true })
  assert.match(failed.html, /role="alert"/)
  assert.doesNotMatch(failed.html, /Abrir |Acceso rápido a |módulos disponibles/)
  failed.nodes.find(node => node.props.children === 'Reintentar').props.onClick()
  assert.deepEqual(failed.retries, ['retry'])
})

test('session entry keeps the same compact home structure without mounting private routes or identity', () => {
  const { HomeLoadingPage } = loadReportModule('../../components/layout/HomeLoadingPage.tsx')
  const html = renderToStaticMarkup(React.createElement(HomeLoadingPage))
  assert.match(html, /aria-label="Inicio"/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /max-w-\[420px\]/)
  assert.match(html, /xl:grid-cols-5/)
  assert.doesNotMatch(html, /<aside|Empresa QA|Persona QA|\/ventas|Verificando tu sesión/)
})

test('the complete catalogue preserves every enabled module and the approved visual order', () => {
  const result = renderHome({ enabled: new Set(['sales', 'quotes', 'orders', 'returns', 'promotions', 'inventory', 'inventory-count', 'merchandise', 'transfers', 'receivables', 'accounting', 'cash-closure', 'contacts', 'hr', 'payroll', 'branches', 'users', 'catalogs', 'config', 'analytics', 'reports', 'alerts']) })
  const labels = [...result.html.matchAll(/<button[^>]*aria-label="Abrir ([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(labels, ['Ventas', 'Cotizaciones', 'Pedidos', 'Devoluciones', 'Promociones', 'Inventario', 'Inventariado', 'Mercancía', 'Traslados', 'Cartera', 'Contabilidad', 'Cierre de Caja', 'Contactos', 'RRHH', 'Nómina', 'Sucursales', 'Usuarios', 'Configuración', 'Análisis', 'Reportes', 'Alertas'])
  assert.match(result.html, /21 módulos disponibles/)
  assert.doesNotMatch(result.html, /Scanner/)
})

test('shared launcher filtering hides master data but retains all 23 technical manifests and catalog-only discovery', () => {
  const previousWindow=global.window,previousStorage=global.localStorage
  global.window={};global.localStorage={getItem:()=>JSON.stringify({role:{name:'staff'},permissions:['catalogs.manage']})}
  try {
    const {appModules,getVisibleModules,assertAppModuleCatalog}=loadReportModule('../../config/appModules.ts')
    assert.equal(appModules.length,23);assert.equal(assertAppModuleCatalog(),true)
    assert.ok(appModules.some(m=>m.id==='catalogs'))
    assert.deepEqual(getVisibleModules(new Set(['config','catalogs'])).map(m=>m.id),['config'])
  } finally {global.window=previousWindow;global.localStorage=previousStorage}
})

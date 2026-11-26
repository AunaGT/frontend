const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

function renderCatalog({ loading = false, error = '' } = {}) {
  let stateIndex = 0
  const nodes = [], navigations = [], values = [], effects = []
  const Page = loadReportModule('../config/pages/CustomerPagesPage.tsx', {
    react: { ...React, useState: initial => {
      const index = stateIndex++
      if (!Object.hasOwn(values, index)) values[index] = index === 5 ? loading : index === 7 ? error : initial
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next }]
    }, useEffect: effect => effects.push(effect) },
    'react-router-dom': { useNavigate: () => path => navigations.push(path) },
    '../customerPages/usePortalScope': { usePortalScope: () => ({
      scope: { companyId: 'company', userId: 'user', sessionId: 'session' },
      canRead: true, canManage: true, canPublish: true, readOnly: false,
      companyName: 'Empresa', key: 'scope',
    }) },
    '../customerPages/PortalSettingsLayout': {
      PortalSettingsLayout: ({ children }) => React.createElement('main', null, children),
    },
    '../documentTemplates/useTemplateConfirmation': { useTemplateConfirmation: () => ({ confirm() {}, dialog: null }) },
    '../customerPages/api': { listPortalTemplates: async () => ({ rows: [], total: 0 }) },
    '@/hooks/use-toast': { toast() {} },
  }, nodes).default
  const render = () => {
    stateIndex = 0
    effects.length = 0
    return renderToStaticMarkup(React.createElement(Page))
  }
  return { html: render(), nodes, navigations, finishRequest: async () => {
    render()
    effects[0]()
    await new Promise(setImmediate)
    return render()
  } }
}

test('an empty customer-page catalog shows the system illustration and retains its working create action', () => {
  const { html, nodes, navigations } = renderCatalog()
  assert.match(html, /<img[^>]+src="\/illustrations\/empty-states\/workspace-flat\.png"[^>]+alt=""[^>]+aria-hidden="true"/)
  assert.match(html, /Tu próxima presentación empieza aquí/)
  const create = nodes.find(n => n.props.children === 'Crear mi primera página' && n.props.onClick)
  assert.ok(create)
  create.props.onClick()
  assert.deepEqual(navigations, ['/configuracion/paginas-clientes/nueva'])
})

test('loading or failed catalog requests do not masquerade as an illustrated empty collection', () => {
  assert.doesNotMatch(renderCatalog({ loading: true }).html, /workspace-flat\.png|Crear mi primera página/)
  const failed = renderCatalog({ error: 'No se pudieron cargar las páginas' }).html
  assert.match(failed, /No se pudieron cargar las páginas/)
  assert.match(failed, /Reintentar/)
  assert.doesNotMatch(failed, /workspace-flat\.png|Crear mi primera página/)
})

test('a successful retry clears the previous request error and restores the illustrated empty collection', async () => {
  const catalog = renderCatalog({ error: 'No se pudieron cargar las páginas' })
  const retry = catalog.nodes.find(n => n.props.children === 'Reintentar' && n.props.onClick)
  retry.props.onClick()
  const html = await catalog.finishRequest()
  assert.doesNotMatch(html, /No se pudieron cargar las páginas/)
  assert.match(html, /workspace-flat\.png/)
})

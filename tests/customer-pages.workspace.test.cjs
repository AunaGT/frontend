const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { resolveBase } = require('../../deposito-backend/src/modules/config/customerPages/bases')
const { definitions } = require('../../deposito-backend/src/modules/config/customerPages/schema')

test('editor layout keeps configuration navigation without the duplicate breadcrumb', () => {
  const { PortalSettingsLayout } = loadReportModule('../config/customerPages/PortalSettingsLayout.tsx', {
    'react-router-dom': { useNavigate: () => () => {} },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => true }) },
    '@/context/useModules': { useModules: () => ({ enabledModuleCodes: new Set() }) },
  })
  const html = renderToStaticMarkup(React.createElement(PortalSettingsLayout, {
    editor: true, companyName: 'Empresa',
  }, React.createElement('div', null, 'Espacio de edición')))
  assert.match(html, /aria-label="Secciones de configuración"/)
  assert.match(html, /portal-settings-editor/)
  assert.doesNotMatch(html, /aria-label="Ruta de páginas"/)
  assert.match(html, /Espacio de edición/)
})

function editor({ canCode = true, readOnly = false } = {}) {
  let index = 0
  const values = [], nodes = [], changes = []
  const design = resolveBase('QUOTE')
  const capabilities = { ready: false, reason: 'Ejecución pendiente en el servidor', codeEnabled: true, policyVersion: 1 }
  const { PortalCodePolicy } = loadReportModule('../config/customerPages/PortalCodePolicy.tsx', {
    '../documentTemplates/useTemplateConfirmation': { useTemplateConfirmation: () => ({ confirm() {}, dialog: null }) },
    './api': {},
  })
  const { PortalEditor } = loadReportModule('../config/customerPages/PortalEditor.tsx', {
    react: { ...React, useState: initial => {
      const key = index++
      if (!Object.hasOwn(values, key)) values[key] = typeof initial === 'function' ? initial() : initial
      return [values[key], next => { values[key] = typeof next === 'function' ? next(values[key]) : next }]
    } },
    './PortalAssetLibrary': { usePortalAssetUrls: () => ({}), PortalAssetLibrary: () => null },
    './engine/PuckAdapter': { PuckAdapter: ({ header, left, right }) => React.createElement(React.Fragment, null, header, left, right) },
    './PortalLibrary': { PortalLibrary: () => null },
    '../documentTemplates/useTemplateConfirmation': { useTemplateConfirmation: () => ({ confirm: async () => false, dialog: null }) },
    './api': {},
  }, nodes)
  const props = { design, record: { id: 'draft', design, capabilities }, scope: {},
    schema: { blocks: definitions, capabilities }, readOnly, canCode,
    onChange: next => changes.push(next), saveNow: async () => ({}), onRecord() {}, onTestCode() {},
    settings: React.createElement(PortalCodePolicy, { scope: {}, capabilities, readOnly, onChange() {} }),
  }
  const render = () => { props.design = changes.at(-1) || props.design; index = 0; nodes.length = 0; return renderToStaticMarkup(React.createElement(PortalEditor, props)) }
  const click = label => {
    const button = nodes.find(n => n.type === 'button' && (n.props.children === label || n.props['aria-label'] === label || Array.isArray(n.props.children) && n.props.children.some(c => typeof c === 'string' && c.trim() === label)))
    assert.ok(button, label + ' must be available')
    button.props.onClick()
  }
  return { render, click, nodes, changes }
}

test('whole-page code opens without creating a decorative block or changing the document', () => {
  const e = editor()
  const initial = e.render()
  assert.doesNotMatch(initial, /Ejecución pendiente en el servidor/)
  e.click('Código de página')
  const html = e.render()
  assert.equal(e.changes.length, 0)
  assert.match(html, /Cargando código de página/)
  assert.doesNotMatch(html, /<iframe|<script/)
  e.click('Diseño')
  assert.doesNotMatch(e.render(), /Cargando código de página/)
  e.click('Código de página')
  assert.match(e.render(), /Cargando código de página/)
  assert.equal(e.changes.length, 0)
})

test('advanced settings are discoverable in the editor panel, without creating a full-width preamble', () => {
  const e = editor()
  e.render()
  e.click('Ajustes')
  const html = e.render()
  assert.match(html, /Ejecución pendiente en el servidor/)
  assert.match(html, /Estilo general de la página/)
})

test('page settings persist edge-to-edge content, preserve colors and reset automatic gutters', () => {
  const e = editor()
  e.render(); e.click('Ajustes'); e.render()
  const control = label => {
    const found = e.nodes.find(n => n.props['aria-label'] === label)
    assert.ok(found, label + ' must be available')
    return found.props
  }
  assert.equal(control('Ancho del contenido').value, 'contained')
  control('Ancho del contenido').onChange({ target: { value: 'full' } })
  e.render()
  control('Margen exterior').onChange({ target: { value: '0' } })
  e.render()
  assert.equal(control('Ancho del contenido').value, 'full')
  assert.equal(control('Margen exterior').value, 0)
  assert.equal(e.changes.at(-1).theme.background, '#ffffff')
  assert.equal(e.changes.at(-1).theme.contentWidth, 'full')
  const count = e.changes.length
  control('Margen exterior').onChange({ target: { value: '97' } })
  assert.equal(e.changes.length, count)
  control('Margen exterior').onChange({ target: { value: '' } })
  assert.equal(Object.hasOwn(e.changes.at(-1).theme, 'padding'), false)
  const locked = editor({ readOnly: true })
  locked.render(); locked.click('Ajustes'); locked.render()
  for (const label of ['Ancho del contenido', 'Margen exterior']) {
    const field = locked.nodes.find(n => n.props['aria-label'] === label)
    assert.equal(field.props.disabled, true)
    field.props.onChange({ target: { value: label === 'Ancho del contenido' ? 'full' : '0' } })
  }
  assert.equal(locked.changes.length, 0)
})

test('whole-page source stays available without granting isolated JavaScript permissions', () => {
  const denied = editor({ canCode: false })
  assert.match(denied.render(), /Código de página/)
  assert.doesNotMatch(denied.render(), /JS aislado/)
  const readonly = editor({ readOnly: true })
  readonly.render()
  const undo = readonly.nodes.find(n => n.type === 'button' && n.props['aria-label'] === 'Deshacer')
  assert.equal(undo.props.disabled, true)
})

test('the code editor exposes HTML, CSS and JavaScript without evaluating the supplied source', () => {
  const { PortalCodeEditor } = loadReportModule('../config/customerPages/PortalCodeEditor.tsx')
  const html = renderToStaticMarkup(React.createElement(PortalCodeEditor, {
    block: { html: '<script>throw Error("do not execute")</script>', css: '', js: 'throw Error("do not execute")', fallbackText: 'Decoración' },
    diagnostics: [], onChange() {}, onValidate() {}, onTest() {}, disabled: false,
  }))
  assert.match(html, />HTML</)
  assert.match(html, />CSS</)
  assert.match(html, />JS</)
  assert.match(html, /Validar sintaxis/)
  assert.match(html, /Ir a prueba aislada/)
  assert.doesNotMatch(html, /<script|<iframe|do not execute/)
})

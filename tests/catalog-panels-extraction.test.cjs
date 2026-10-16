const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { catalogPanelHarness } = require('./helpers/catalogPanelHarness.cjs'), { assertPaginationOutside } = require('./pagination-assertions.cjs')
const { loadReportModule } = require('./helpers/loadReportModule.cjs'), { flush } = require('./helpers/configHarness.cjs')
test('category and terms screens preserve the established extraction baseline', () => {
  for (const kind of ['categories', 'payment-terms']) {
    const h = catalogPanelHarness(kind)
    try {
      const html = h.render(); assertPaginationOutside(html)
      assert.ok(html.indexOf('metric-strip') < html.indexOf('compact-filter-toolbar'))
      if (kind === 'categories') { assert.match(html, /category\.png/); assert.match(html, />9<\/td>/); assert.match(html, />3<\/td>/) }
      else { assert.match(html, /0 d/); assert.match(html, />5<\/td>/); assert.match(html, />2<\/td>/); assert.match(html, /Sin plazo/) }
    } finally { h.unmount() }
  }
})
test('standalone extracted panels retain summaries, deletion filter and external pagination', () => {
  for (const kind of ['categories', 'payment-terms']) {
    const h = catalogPanelHarness(kind)
    try {
      const html = h.render(); assertPaginationOutside(html)
      assert.ok(html.indexOf('metric-strip') < html.indexOf('compact-filter-toolbar'))
      assert.ok(h.queries.every(q => q.includeSummary && q.pageSize === 10))
      h.button('Ver eliminados').props.onClick(); h.render(); assert.equal(h.queries.at(-1).includeDeleted, true)
      h.button('Importar').props.onClick(); assert.equal(h.navigations.at(-1), kind === 'categories' ? '/inventario/categorias/importar' : '/configuracion/condiciones-de-pago/importar')
    } finally { h.unmount() }
  }
})
test('extracted category editor preserves the selected image and identity when saving', async () => {
  const h = catalogPanelHarness('categories')
  try {
    h.render(); h.nodes.find(n => n.type?.name === 'CatalogRowActions').props.onEdit(); h.render(); h.render()
    h.input('categoryName').props.onChange({ target: { value: '  Bebidas editadas  ' } }); h.render()
    await h.submit('categoryName')
    assert.deepEqual(h.writes, [['update', { id: 4, data: { name: 'Bebidas editadas', image_url: 'https://example.invalid/category.png' } }]])
  } finally { h.unmount() }
})
test('extracted payment-term editor distinguishes explicit zero from clearing its due days', async () => {
  for (const [value, want] of [['0', 0], ['', null]]) {
    const h = catalogPanelHarness('payment-terms')
    try {
      h.render(); h.nodes.find(n => n.type?.name === 'CatalogRowActions' && n.props.onEdit).props.onEdit(); h.render(); h.render()
      h.input('net-days').props.onChange({ target: { value } }); h.render(); await h.submit('name')
      assert.deepEqual(h.writes[0], ['update', { id: 6, data: { name: 'Contado', net_days: want } }])
    } finally { h.unmount() }
  }
})
test('failed extracted saves keep the entered data and report the actual error', async () => {
  const h = catalogPanelHarness('categories', { failWrite: true })
  try {
    h.render(); h.button('Nueva categoría').props.onClick(); h.render(); h.render()
    h.input('categoryName').props.onChange({ target: { value: 'Pendiente' } }); h.render(); await h.submit('categoryName'); h.render()
    assert.equal(h.input('categoryName').props.value, 'Pendiente'); assert.equal(h.toasts.at(-1).variant, 'destructive'); assert.match(h.toasts.at(-1).description, /Error de prueba/)
  } finally { h.unmount() }
})
test('extracted soft delete and restore keep their record IDs and confirmations', async () => {
  for (const [kind, operation, label] of [['categories', 'delete', 'Eliminar'], ['payment-terms', 'restore', 'Restaurar']]) {
    const h = catalogPanelHarness(kind)
    try {
      h.render(); h.nodes.find(n => n.type?.name === 'CatalogRowActions' && n.props[operation === 'delete' ? 'onDelete' : 'onRestore']).props[operation === 'delete' ? 'onDelete' : 'onRestore'](); h.render()
      h.button(label).props.onClick({ preventDefault() {} }); await flush()
      assert.deepEqual(h.writes[0], [operation, kind === 'categories' ? 4 : 7])
    } finally { h.unmount() }
  }
})
test('read-only extracted catalogs never offer mutations or import', () => {
  for (const kind of ['categories', 'payment-terms']) {
    const h = catalogPanelHarness(kind, { manage: false })
    try { const html = h.render(); assert.doesNotMatch(html, /Nueva categoría|Nuevo término|>Importar<|aria-label="Editar"/) } finally { h.unmount() }
  }
})
test('catalog import can receive an explicit type and return destination without reading a return URL', () => {
  const nodes = [], navigate = []
  const Page = loadReportModule('../catalogs/pages/CatalogImportPage.tsx', {
    '@/context/useModules': { useModules: () => ({enabledModuleCodes:new Set(['catalogs','inventory']),isEnabled:()=>true,isLoading:false,isError:false}) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({permissionsReady:true,hasPermission:()=>true}) },
    'react-router-dom': { ...require('react-router-dom'), useNavigate: () => path => navigate.push(path) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) }, '@/services/api': { getApiBaseUrl: () => 'https://api.invalid' },
  }, nodes).default
  renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/configuracion/condiciones-de-pago/importar?type=categories&back=https://outside.invalid'] }, React.createElement(Page, { catalogType: 'payment-terms', backPath: '/configuracion/condiciones-de-pago' })))
  const step = nodes.find(n => n.type?.name === 'ImportWorkbench')
  assert.ok(step, 'the current import workbench is mounted')
  assert.equal(step.props.title, 'Importar términos de pago'); assert.equal(step.props.templatePath, '/catalogs/payment-terms/template')
  assert.equal(step.props.back, '/configuracion/condiciones-de-pago')
})

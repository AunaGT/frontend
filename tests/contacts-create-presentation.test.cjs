const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

function renderCreate({ allowed = true, pending = false } = {}) {
  const nodes = [], toasts = [], navigations = [], requests = []
  const Page = loadReportModule('../contacts/components/SupplierCreatePage.tsx', {
    'react-router-dom': { useNavigate: () => target => navigations.push(target) },
    '@/hooks/use-toast': { useToast: () => ({ toast: value => toasts.push(value) }) },
    '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ hasPermission: () => allowed }) },
    '@/hooks/useCreateSupplier': { useCreateSupplier: () => ({ isPending: pending, mutateAsync: async payload => { requests.push(payload); return { id: 'qa-contact' } } }) },
    '@/hooks/useCategories': { useCategories: () => ({ data: { items: [{ id: 1, name: 'Bebidas' }] } }) },
    '@/hooks/usePaymentTerms': { usePaymentTerms: () => ({ data: { items: [{ id: 1, name: 'Contado' }] } }) },
    '@/hooks/useSuppliers': { SUPPLIERS_QUERY_KEY: ['suppliers'] },
    '@/services/supplierService': { uploadSupplierImage() { throw new Error('No external writes in presentation checks') } },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
  }, nodes).default
  return { html: renderToStaticMarkup(React.createElement(Page)), nodes, toasts, navigations, requests }
}

test('creation groups identity, contact/address and payment into named sections with shared fields', () => {
  const { html, nodes } = renderCreate()
  const sections = nodes.filter(node => node.type === 'section' && node.props['aria-labelledby'])
  assert.equal(sections.length, 3, 'Three compact groups replace the single oversized form card')
  for (const section of sections) {
    const heading = nodes.find(node => node.type === 'h2' && node.props.id === section.props['aria-labelledby'])
    assert.ok(heading, 'Each section has its visible accessible heading')
  }
  for (const id of ['name', 'contact', 'phone', 'email', 'address', 'tax-id', 'categories', 'terms']) {
    assert.match(html, new RegExp(`for="${id}"`), `Visible label for ${id}`)
    assert.match(html, new RegExp(`id="${id}"`), `House control for ${id}`)
  }
  assert.match(html, /class="sr-only">Nuevo contacto/)
  for (const choice of nodes.filter(node => node.type === 'label' && node.props.className === 'contact-create-choice')) {
    assert.ok(choice.props.htmlFor)
    assert.equal(typeof choice.props['data-selected'], 'boolean')
  }
})

test('optional image stays in a collapsed side panel and remains permission gated', () => {
  const { html, nodes } = renderCreate()
  const disclosure = nodes.find(node => node.type === 'details')
  assert.ok(disclosure, 'The optional dropzone must not dominate the initial form')
  assert.equal(disclosure.props.open, undefined)
  assert.match(html, /contact-no-image.svg/)
  assert.match(html, /aria-label="Seleccionar imagen"/)
  assert.doesNotMatch(renderCreate({ allowed: false }).html, /type="file"/)
})

test('empty form keeps required validation and loading blocks repeat creation', async () => {
  const result = renderCreate()
  const save = result.nodes.find(node => node.props.onClick && renderToStaticMarkup(React.createElement(React.Fragment, null, node.props.children)).includes('Guardar contacto'))
  assert.ok(save)
  await save.props.onClick()
  assert.equal(result.requests.length, 0)
  assert.equal(result.navigations.length, 0)
  assert.equal(result.toasts[0].description, 'El nombre o razón social es obligatorio')
  const loading = renderCreate({ pending: true })
  const disabledSave = loading.nodes.find(node => node.props.onClick && node.props.disabled && renderToStaticMarkup(React.createElement(React.Fragment, null, node.props.children)).includes('Guardando...'))
  assert.ok(disabledSave, 'Save remains disabled while creation is pending')
  await disabledSave.props.onClick()
  assert.equal(loading.requests.length, 0)
})

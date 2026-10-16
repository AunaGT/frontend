const test = require('node:test'), assert = require('node:assert/strict'), React = require('react'), fs = require('node:fs'), path = require('node:path')
const { renderToStaticMarkup } = require('react-dom/server'), { MemoryRouter } = require('react-router-dom')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
test('old catalogs and imports resolve their canonical destination without losing unrelated parameters', () => {
  const { legacyCatalogDestination: resolve } = loadReportModule('../catalogs/navigation.ts')
  for (const prefix of ['/datos-maestros', '/catalogos']) {
    for (const [query, target] of [['', '/inventario/categorias'], ['?tab=categories', '/inventario/categorias'], ['?tab=payment-methods&source=qa', '/configuracion/metodos-de-pago?source=qa'], ['?tab=cash-registers', '/configuracion/cajas'], ['?tab=payment-terms', '/configuracion/condiciones-de-pago'], ['?tab=desconocida', '/inventario/categorias'], ['?tab=https://outside.invalid&tab=payment-terms&foo=1&foo=2', '/inventario/categorias?foo=1&foo=2']]) assert.equal(resolve(prefix, query), target)
    assert.equal(resolve(prefix + '/importar', '?type=payment-terms'), '/configuracion/condiciones-de-pago/importar')
    assert.equal(resolve(prefix + '/importar', '?type=categories&tab=payment-methods&source=qa'), '/inventario/categorias/importar?source=qa')
  }
})
test('relocated catalog gate checks original availability, destination permissions and import authority', () => {
  for (const [kind, enabled, perms, flags, allowed] of [
    ['categories', ['catalogs','inventory'], ['catalogs.manage'], {}, true],
    ['categories', ['catalogs'], ['catalogs.view'], {}, false],
    ['payment-methods', [], ['catalogs.manage'], {}, false],
    ['payment-terms', ['catalogs'], ['settings.manage'], {}, false],
    ['cash-registers', ['catalogs'], ['settings.manage'], {}, true],
    ['payment-terms', ['catalogs'], ['catalogs.view'], {}, true],
    ['payment-terms', ['catalogs'], ['catalogs.view'], { importing:true }, false],
    ['categories', ['catalogs','inventory'], ['catalogs.manage'], { isLoading:true }, false],
    ['payment-methods', ['catalogs'], ['catalogs.manage'], { isError:true }, false],
    ['payment-methods', ['catalogs'], ['catalogs.manage'], { unknown:true }, false],
  ]) {
    const Gate = loadReportModule('../catalogs/components/CatalogAccess.tsx', {
      '@/context/useModules': { useModules: () => ({ enabledModuleCodes: flags.unknown ? null : new Set(enabled), isEnabled: code => flags.unknown || enabled.includes(code), isLoading: flags.isLoading, isError: flags.isError }) },
      '@/hooks/useAuthPermissions': { useAuthPermissions: () => ({ permissionsReady:true, hasPermission: (...codes) => codes.some(c=>perms.includes(c)) }) },
    }).CatalogAccess
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Gate, {kind, importing:flags.importing}, React.createElement('b', null, 'EDITOR AUTORIZADO'))))
    assert.equal(html.includes('EDITOR AUTORIZADO'), allowed, JSON.stringify({kind,enabled,perms,flags}))
  }
})
test('destination wrappers consume the public catalog pages with explicit type and trusted return path', () => {
  const cases = [
    ['../inventory/pages/CategoryManagementPage.tsx', {}, 'panel', {kind:'categories'}],
    ['../inventory/pages/CategoryImportPage.tsx', {}, 'import', {catalogType:'categories',backPath:'/inventario/categorias'}],
    ['../config/pages/CatalogSettingsPage.tsx', {kind:'payment-methods'}, 'panel', {kind:'payment-methods'}],
    ['../config/pages/PaymentTermsImportPage.tsx', {}, 'import', {catalogType:'payment-terms',backPath:'/configuracion/condiciones-de-pago'}],
  ]
  const { catalogsModule } = loadReportModule('../catalogs/manifest.ts')
  for (const [file, props, type, expected] of cases) {
    const nodes = [], Page = loadReportModule(file, {'@/modules/catalogs/manifest':{catalogsModule:{...catalogsModule,pages:{Panel:p=>React.createElement('b',null,'panel'),Import:p=>React.createElement('b',null,'import')}}}},nodes).default
    renderToStaticMarkup(React.createElement(Page,props))
    assert.ok(nodes.some(n=>Object.entries(expected).every(([key,value])=>n.props[key]===value)), file)
  }
  const app = fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8')
  for (const route of ['inventoryModule.paths.categories','inventoryModule.paths.categoriesImport','configModule.paths.cashRegisters','configModule.paths.paymentMethods','configModule.paths.paymentTerms','configModule.paths.paymentTermsImport']) assert.ok(app.includes(`path={${route}}`),route)
})

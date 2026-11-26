const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')
const scope = { companyId: 'company', branchId: 'branch', userId: 'user', sessionId: 'session' }
const connection = { id: 'connector', revision: 1, environment: 'TEST', state: 'DRAFT', capabilities: { encryptionReady: true, externalSendingAllowed: false }, credentialStatus: { signUser: true, signKey: true, apiUser: true, apiKey: true } }
const tick = () => new Promise(resolve => setImmediate(resolve))
test('connection form writes only changed secrets and reuses a failed attempt key', async () => {
  const harness = hookHarness(), writes = [], local = []; let fail = true
  const api = {
    readConnection: async () => connection,
    saveConnection: async (...args) => { writes.push(args); if (fail) throw new Error('Sin respuesta'); return { ...connection, revision: 2 } },
    validateLocally: async (...args) => { local.push(args); return { kind: 'LOCAL_ONLY', externalContact: false, credentialsVerified: false } },
  }
  const { useInfileConnection } = loadReportModule('../config/connectors/useInfileConnection.ts', { react: harness.hooks, './api': api })
  let state = harness.render(() => useInfileConnection(scope, 'TEST')); await tick()
  state = harness.render(() => useInfileConnection(scope, 'TEST'))
  assert.equal(state.fields.apiKey, '')
  state.setField('apiKey', 'new-local-only-secret')
  state = harness.render(() => useInfileConnection(scope, 'TEST'))
  const pending = state.save(); assert.equal(await state.save(), null); await pending
  fail = false; state = harness.render(() => useInfileConnection(scope, 'TEST')); await state.save()
  assert.equal(writes.length, 2)
  assert.equal(writes[0][2].idempotencyKey, writes[1][2].idempotencyKey)
  assert.deepEqual(writes[0][2].credentials, { apiKey: 'new-local-only-secret' })
  assert.equal(writes[0][2].expectedVersion, 1)
  state = harness.render(() => useInfileConnection(scope, 'TEST'))
  assert.equal(state.fields.apiKey, ''); assert.equal(state.dirty, false)
  await state.validate(); assert.equal(local.length, 1)
  state = harness.render(() => useInfileConnection(scope, 'TEST'))
  assert.equal(state.review.kind, 'LOCAL_ONLY'); assert.equal(state.connection.state, 'DRAFT')
  harness.unmount()
})
test('obsolete loads cannot populate a different company form', async () => {
  const harness = hookHarness(), requests = []
  const { useInfileConnection } = loadReportModule('../config/connectors/useInfileConnection.ts', { react: harness.hooks, './api': { readConnection: (...args) => new Promise(resolve => requests.push({ args, resolve })) } })
  harness.render(() => useInfileConnection(scope, 'TEST'))
  const other = { ...scope, companyId: 'other' }
  let state = harness.render(() => useInfileConnection(other, 'TEST'))
  requests[0].resolve(connection); await tick()
  state = harness.render(() => useInfileConnection(other, 'TEST'))
  assert.equal(state.connection, null); assert.equal(requests[0].args[2].aborted, true)
  requests[1].resolve({ ...connection, id: 'other-connector' }); await tick()
  state = harness.render(() => useInfileConnection(other, 'TEST')); assert.equal(state.connection.id, 'other-connector')
  harness.unmount()
})
test('fiscal API pins company/session before and after requests and has no external operation', async () => {
  let company = scope.companyId, calls = 0
  const { readConnection, saveConnection } = loadReportModule('../config/connectors/api.ts', {
    '@/services/api': { getActiveCompanyId: () => company, getActiveBranchId: () => scope.branchId, apiFetch: async (url, options) => { calls++; assert.match(url, /^\/settings\/connectors\/infile\/TEST$/); assert.equal(options.headers['X-Company-Id'], scope.companyId); company = 'other'; return connection } },
    '@/services/authSession': { authSessionIdentity: () => scope.sessionId, authSessionMatches: () => true },
  })
  await assert.rejects(readConnection(scope, 'TEST'), error => error.name === 'AbortError')
  await assert.rejects(saveConnection(scope, 'TEST', {}), error => error.name === 'AbortError')
  assert.equal(calls, 1)
})

test('connector settings clearly show local-only status, masked replacement fields and no activation', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const { InfileConnection } = loadReportModule('../config/pages/ConnectorsPage.tsx', {
    'react-router-dom': { useNavigate: () => () => {} },
    '../documentTemplates/TemplateSettingsLayout': { TemplateSettingsLayout: ({ children }) => React.createElement('main', {}, children) },
    '../connectors/api': { readConnectionHistory() { throw new Error('No history request expected during render') } },
    '../connectors/useConnectorScope': {},
    './ConnectorCatalog': {},
    '@/components/layout/PageNavigation': { usePageTrail() {} },
    '../connectors/useInfileConnection': { useInfileConnection: () => ({ connection, fields: { signUser: '', signKey: '', apiUser: '', apiKey: '' }, loading: false, pending: false, dirty: false, error: '', fieldErrors: {}, review: null, activity: { current: { dirty: false, pending: false } }, setField() {} }) },
    '../documentTemplates/useTemplateLeaveGuard': { useTemplateLeaveGuard: () => () => true },
    '../documentTemplates/useTemplateConfirmation': { useTemplateConfirmation: () => ({ dialog: null, confirm: async () => true }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
  })
  const html = renderToStaticMarkup(React.createElement(InfileConnection, { scope, environment: 'TEST', canManage: true, canTest: true, registerGuard: () => () => {}, onEnvironment() {}, companyName: 'Empresa de prueba' }))
  assert.match(html, /Sin envíos a Infile/)
  assert.match(html, /Revisar localmente/)
  assert.match(html, /No verifica tus credenciales/)
  assert.equal((html.match(/type="password"/g) || []).length, 4)
  assert.doesNotMatch(html, /Activar producción|Conexión aprobada/)
  assert.doesNotMatch(html, /new-local-only-secret/)
  assert.match(html, /URLs por acción/)
  assert.match(html, /infile-endpoint-ISSUE/)
  assert.match(html, /infile-endpoint-CREDIT_NOTE/)
  assert.match(html, /infile-endpoint-CANCEL/)
  assert.match(html, /infile-endpoint-LOOKUP/)
})
test('connection can prepare URLs before credentials and clearing one sends an explicit removal', async () => {
  const harness = hookHarness(), writes = []
  const blank = { ...connection, id: null, revision: 0, endpoints: { ISSUE: null, CREDIT_NOTE: null, CANCEL: null, LOOKUP: null }, credentialStatus: { signUser: false, signKey: false, apiUser: false, apiKey: false } }
  const { useInfileConnection } = loadReportModule('../config/connectors/useInfileConnection.ts', { react: harness.hooks, './api': { readConnection: async () => blank, saveConnection: async (_scope, _env, body) => { writes.push(body); return { ...blank, id: 'connector', revision: writes.length, endpoints: { ...blank.endpoints, ...body.endpoints } } } } })
  let state = harness.render(() => useInfileConnection(scope, 'TEST')); await tick()
  state = harness.render(() => useInfileConnection(scope, 'TEST'))
  state.setEndpoint('ISSUE', 'https://provider.example.invalid/issue')
  state = harness.render(() => useInfileConnection(scope, 'TEST')); await state.save()
  assert.equal(writes.length, 1); assert.equal(writes[0].credentials, undefined)
  assert.deepEqual(writes[0].endpoints, { ISSUE: 'https://provider.example.invalid/issue' })
  state = harness.render(() => useInfileConnection(scope, 'TEST')); assert.equal(state.dirty, false)
  state.setEndpoint('ISSUE', '')
  state = harness.render(() => useInfileConnection(scope, 'TEST')); await state.save()
  assert.deepEqual(writes[1].endpoints, { ISSUE: null }); assert.equal(writes[1].expectedVersion, 1)
  harness.unmount()
})
test('invalid proposed URL stays in the form and never reaches the configuration API', async () => {
  const harness = hookHarness(); let writes = 0
  const { useInfileConnection } = loadReportModule('../config/connectors/useInfileConnection.ts', { react: harness.hooks, './api': { readConnection: async () => connection, saveConnection: async () => { writes++; return connection } } })
  let state = harness.render(() => useInfileConnection(scope, 'TEST')); await tick()
  state = harness.render(() => useInfileConnection(scope, 'TEST')); state.setEndpoint('ISSUE', 'https://user:synthetic-secret@provider.example.invalid/')
  state = harness.render(() => useInfileConnection(scope, 'TEST')); state.validateEndpoint('ISSUE')
  state = harness.render(() => useInfileConnection(scope, 'TEST'))
  assert.ok(state.fieldErrors['endpoints.ISSUE']); await state.save()
  state = harness.render(() => useInfileConnection(scope, 'TEST'))
  assert.equal(writes, 0); assert.match(state.endpoints.ISSUE, /synthetic-secret/)
  assert.equal(state.fieldErrors['endpoints.ISSUE'].includes('synthetic-secret'), false)
  harness.unmount()
})
test('correcting an invalid URL keeps its input section open', () => {
  const harness = hookHarness(), nodes = []
  const form = { connection, fields: {}, endpoints: { ISSUE: 'invalid' }, loading: false, pending: false, dirty: true, error: '', fieldErrors: {}, review: null, activity: { current: { dirty: true, pending: false } }, validateEndpoint() { this.fieldErrors = { 'endpoints.ISSUE': 'Usa HTTPS' } }, setEndpoint(_action, value) { this.endpoints.ISSUE = value; this.fieldErrors = {} } }
  const { InfileConnection } = loadReportModule('../config/pages/ConnectorsPage.tsx', {
    react: harness.hooks,
    '../documentTemplates/TemplateSettingsLayout': { TemplateSettingsLayout: () => null },
    '../connectors/api': {},
    '../connectors/useConnectorScope': {},
    './ConnectorCatalog': {},
    'react-router-dom': { useNavigate: () => () => {} },
    '../connectors/useInfileConnection': { useInfileConnection: () => form },
    '../documentTemplates/useTemplateLeaveGuard': { useTemplateLeaveGuard: () => () => true },
    '../documentTemplates/useTemplateConfirmation': { useTemplateConfirmation: () => ({ dialog: null, confirm: async () => true }) },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) },
    '@/components/layout/PageNavigation': { usePageTrail() {} },
  }, nodes)
  const render = () => harness.render(() => InfileConnection({ scope, environment: 'TEST', canManage: true, canTest: true, registerGuard() {}, companyName: 'Empresa local', onEnvironment() {} }))
  const urlInput = () => nodes.findLast(node => node.props.id === 'infile-endpoint-ISSUE')
  render(); urlInput().props.onBlur(); render(); render()
  assert.equal(nodes.findLast(node => node.type === 'details').props.open, true)
  urlInput().props.onChange({ target: { value: 'https://provider.example.invalid/issue' } }); render()
  assert.equal(nodes.findLast(node => node.type === 'details').props.open, true)
  assert.equal(urlInput().props.value, 'https://provider.example.invalid/issue')
  harness.unmount()
})

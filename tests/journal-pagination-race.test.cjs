const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { hookHarness } = require('./helpers/reportHookHarness.cjs')
const { deferred, flush } = require('./helpers/configHarness.cjs')

test('changing journal size uses one new fetch path and an older response cannot replace the new page', async () => {
  const h = hookHarness(), nodes = [], requests = [], toast = () => {}
  const { JournalTab } = loadReportModule('../accounting/components/JournalTab.tsx', {
    react: h.hooks,
    'react-router-dom': { useNavigate: () => () => {} },
    '@/context/useTenant': { useTenant: () => ({ branches: [], company: { id: 'A' } }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ timezone: 'UTC' }) },
    '@/hooks/use-toast': { useToast: () => ({ toast }) },
    '@/services/api': { apiFetch() { throw Error('No real requests') } },
    '@/services/accountingService': { getJournal: params => { const d = deferred(); requests.push({ params, ...d }); return d.promise } },
  }, nodes)
  const render = () => { nodes.length = 0; return h.render(() => JournalTab({ accounts: [], canCreate: false })) }
  render()
  requests[0].resolve({ items: [], page: 1, totalPages: 4, totalItems: 31 })
  await flush(); render()
  const pagination = nodes.find(n => n.props.itemLabel === 'asientos')
  pagination.props.onPageChange(2)
  render()
  pagination.props.onPageSizeChange(25)
  pagination.props.onPageChange(1)
  render()
  assert.deepEqual(requests.map(r => [r.params.page, r.params.pageSize]), [[1, 50], [2, 50], [1, 25]])
  const row = reference => ({ id: reference, entry_number: reference, date: '2026-10-16', description: 'Prueba', source_type: 'MANUAL', lines: [] })
  requests[2].resolve({ items: [row('NEW-25')], page: 1, totalPages: 2, totalItems: 31 })
  await flush(); render()
  requests[1].resolve({ items: [row('OLD-10')], page: 2, totalPages: 4, totalItems: 31 })
  await flush()
  const html = renderToStaticMarkup(render())
  assert.match(html, /NEW-25/); assert.doesNotMatch(html, /OLD-10/)
  h.unmount()
})

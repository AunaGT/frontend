const test = require('node:test'), assert = require('node:assert/strict'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')

test('product sales history includes the chosen size in both its request and cache and exposes standard choices', async () => {
  const queries = [], requests = [], changes = [], nodes = []
  const { ProductCommercialHistory } = loadReportModule('../inventory/products/ProductCommercialHistory.tsx', {
    '@/hooks/usePersistedListUiState': { usePersistedListUiState: () => ({ page: 2, pageSize: 25, setPage: value => changes.push(['page', value]), setPageSize: value => changes.push(['size', value]) }) },
    '@/hooks/useSystemSettings': { useSystemSettings: () => ({ locale: 'es-GT', currencyCode: 'GTQ' }) },
    '@/services/api': { apiFetch: async url => { requests.push(url) } },
    '@tanstack/react-query': { useQuery: options => { queries.push(options); return { data: { items: [{ id: 'i', qty: '1', net_total: '12', sale: { id: 's', date: '2026-10-16', customer: 'QA' } }], page: 2, pageSize: 25, totalItems: 51, totalPages: 3, nextPage: 3, prevPage: 1 } } } },
    'react-router-dom': { Link: ({to,children,...props}) => React.createElement('a', { href:to,...props }, children) },
  }, nodes)
  const html = renderToStaticMarkup(React.createElement(ProductCommercialHistory, { productId: 'p' }))
  assert.deepEqual(queries[0].queryKey, ['product-commercial-history', 'p', 2, 25])
  await queries[0].queryFn()
  assert.deepEqual(requests, ['/api/products/p/commercial-history?page=2&pageSize=25'])
  assert.match(html, /Mostrando 26 a 26 de 51 partidas/)
  const select = nodes.find(n => n.type === 'select')
  assert.deepEqual(select.props.children.map(n => n.props.value), [10,25,50,100])
  select.props.onChange({ target: { value: '50' } })
  assert.deepEqual(changes, [['size',50],['page',1]])
})

test('both participant tables share the requested size while waitlist admission stays FIFO', () => {
  const nodes = [], changes = []
  const { SessionParticipants } = loadReportModule('../appointments/components/SessionParticipants.tsx', {
    '../hooks': { useAgendaMutation: () => ({ pending:false }) },
    './ServiceBillingAction': { ServiceBillingAction: () => null },
    './AgendaActions': { AgendaActions: () => null },
    './AgendaPicker': { AgendaPicker: () => null },
  }, nodes)
  const session = { id:'s',status:'SCHEDULED',startsAt:'2030-01-01T10:00Z',timezone:'UTC',capacity:100,occupied:0,
    bookings:{items:[],totalItems:51},waitlist:{items:[{id:'w',contactName:'QA',createdAt:'2026-10-16T10:00Z'}],totalItems:51} }
  renderToStaticMarkup(React.createElement(SessionParticipants, { scope:{},session,has:()=>true,writable:true,page:2,waitPage:2,pageSize:25,onPage(){},onWaitPage(){},search:'',onSearch(){},onPageSizeChange:size=>changes.push(size) }))
  const footers = nodes.filter(n => ['participantes','personas en espera'].includes(n.props.itemLabel))
  assert.equal(footers.length,2)
  for (const footer of footers) { assert.equal(footer.props.pageSize,25); assert.equal(footer.props.totalPages,3); footer.props.onPageSizeChange(50) }
  assert.deepEqual(changes,[50,50])
  assert.equal(nodes.find(n=>n.props.children==='Admitir').props.disabled,true, 'A later waitlist page never bypasses FIFO')
})

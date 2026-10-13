const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { MemoryRouter } = require('react-router-dom')
const root = path.resolve(__dirname, '../src')
const cache = new Map(), overrides = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file, module)
  cache.set(file, mod); mod.paths = Module._nodeModulePaths(path.dirname(file))
  const nativeRequire = mod.require.bind(mod)
  mod.require = name => {
    if (overrides.has(name)) return overrides.get(name)
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return nativeRequire(name)
    return load(['', '.tsx', '.ts', '.js', '/index.tsx', '/index.ts'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile()))
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'), {fileName: file, compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true}}).outputText, file)
  return mod.exports
}
const cases = [
  ['modules/promotions/pages/PromotionsListPage.tsx', 'default', 'promociones consultadas', {total:31,active:12,scheduled:0,ended:9,inactive:3}],
  ['modules/quotes/QuotesManagement.tsx', 'default', 'cotizaciones consultadas', {total:31,draft:12,sent:0,accepted:9}],
  ['modules/returns/pages/ReturnsManagement.tsx', 'default', 'devoluciones consultadas', {total:31,pending:12,approved:0,completed:9,rejected:3}],
  ['modules/transfers/pages/TransfersManagement.tsx', 'TransfersManagement', 'traslados consultados', {total:31,inTransit:12,received:0,cancelled:9}],
  ['modules/merchandise/pages/IncomingMerchandiseManagement.tsx', 'default', 'entradas consultadas', {total:31,paid:12,partial:0,pending:9}],
]
for (const [file, name, label, summary] of cases) test(`${label}: real page renders full summary, zero and unavailable/error states`, async () => {
  let query = {data: {items: [], page: 3, pageSize: 10, totalItems: 31, totalPages: 4, summary}, isLoading:false,isFetching:false,isError:false,refetch(){}}
  const configs = []
  overrides.set('@tanstack/react-query', {useQuery: config => {configs.push(config);return ['promotions','quotes','transfers'].includes(config.queryKey[0]) ? query : {data:[]}},useMutation:()=>({}),useQueryClient:()=>({invalidateQueries(){}})})
  overrides.set('@/hooks/useAuthPermissions', {useAuthPermissions:()=>({hasPermission:()=>true})})
  overrides.set('@/hooks/useSystemSettings', {useSystemSettings:()=>({locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'})})
  overrides.set('@/hooks/use-toast', {useToast:()=>({toast(){}})})
  overrides.set('@/context/useTenant', {useTenant:()=>({branch:{id:'branch-a'},branches:[]})})
  overrides.set('@/hooks/usePersistedListUiState', {usePersistedListUiState:()=>({page:3,pageSize:10,viewMode:'table',setPage(){},setPageSize(){},setViewMode(){}}),useResetPageOnFilterChange(){}})
  const urls = []
  overrides.set('@/services/api', {apiFetch:url=>{urls.push(url);return Promise.resolve(query.data)},getApiBaseUrl:()=>'',getAuthToken:()=>null})
  overrides.set('./api', overrides.get('@/services/api'))
  overrides.set('./PromotionsManagement', {CodesDialog:()=>null})
  overrides.set('@/modules/sales/components/SavedCustomerMany2One', {SavedCustomerMany2One:()=>null})
  overrides.set('../hooks/useReturns', {useReturns: params=>{assert.equal(params.includeSummary,true);return query},useUpdateReturnStatus:()=>({})})
  overrides.set('../hooks/useIncomingMerchandise', {useIncomingMerchandise:params=>{assert.equal(params.includeSummary,true);return query}})
  cache.clear()
  try {
    const Page = load(path.join(root,file))[name]
    const render = () => renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Page)))
    const html = render()
    const strip = html.match(new RegExp(`<section[^>]*aria-label="Resumen ${label}"[^>]*>[\\s\\S]*?</section>`))?.[0]
    assert.ok(strip, 'summary is accessible outside the results')
    assert.ok(html.indexOf(strip) < html.indexOf('class="compact-filter-toolbar'), 'Statistics must precede search and filters')
    assert.match(strip,/metric-strip/)
    assert.match(strip,/>31<\/strong>/)
    assert.match(strip,/>0<\/strong>/)
    assert.equal((strip.match(/metric-strip-value/g)||[]).length,Object.keys(summary).length)
    const list = configs.find(config => ['promotions','quotes','transfers'].includes(config.queryKey[0]))
    if (list) {await list.queryFn();assert.equal(new URL(urls.at(-1),'https://test.invalid').searchParams.get('includeSummary'),'true')}
    query = {...query,data:{...query.data,summary:undefined}}
    assert.equal((render().match(/metric-strip-value[^>]*>—<\/strong>/g)||[]).length,Object.keys(summary).length)
    query = {...query,data:{...query.data,summary},isError:true}
    assert.equal((render().match(/metric-strip-value[^>]*>—<\/strong>/g)||[]).length,Object.keys(summary).length)
  } finally {overrides.clear();cache.clear()}
})

test('list services send summaries only when requested and retain filters', async () => {
  const urls = []
  const api = {apiFetch: url => {urls.push(url);return Promise.resolve({items:[]})}}
  overrides.set('@/services/api',api);overrides.set('./api',api)
  try {
    for (const [file, method, params, filters] of [
      ['services/quoteService.ts','fetchQuotes',{status:'DRAFT',search:'summer',customer_contact_id:'customer-a',date_from:'2026-10-01'},{status:'DRAFT',search:'summer',customer_contact_id:'customer-a',date_from:'2026-10-01'}],
      ['services/tenantService.ts','fetchTransfers',{status:'EN_TRANSITO',search:'summer',fromBranchId:'branch-a',toBranchId:'branch-b'},{status:'EN_TRANSITO',search:'summer',from_branch_id:'branch-a',to_branch_id:'branch-b'}],
      ['modules/returns/api/returnService.ts','fetchReturns',{status:'Pendiente',search:'summer',reason:'damaged',type:'REFUND'},{status:'Pendiente',search:'summer',reason:'damaged',type:'REFUND'}],
      ['modules/merchandise/api/incomingMerchandiseService.ts','fetchIncomingMerchandise',{payment_status:'PAID',search:'summer',supplier_id:'supplier-a'},{payment_status:'PAID',search:'summer',supplier_id:'supplier-a'}],
    ]) {
      const fetchList = load(path.join(root,file))[method]
      await fetchList({...params,includeSummary:true,page:3,pageSize:10})
      const query = new URL(urls.at(-1),'https://test.invalid').searchParams
      assert.equal(query.get('includeSummary'),'true')
      assert.equal(query.get('page'),'3');assert.equal(query.get('pageSize'),'10')
      for (const [key,value] of Object.entries(filters)) assert.equal(query.get(key),value)
      await fetchList(params)
      assert.equal(new URL(urls.at(-1),'https://test.invalid').searchParams.has('includeSummary'),false)
    }
  } finally {overrides.clear();cache.clear()}
})

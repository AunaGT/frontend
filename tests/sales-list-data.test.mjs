import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
function loader(overrides) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = new Module(file)
    cache.set(file, mod)
    mod.paths = Module._nodeModulePaths(path.dirname(file))
    mod.require = name => {
      if (name in overrides) return overrides[name]
      const local = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
      if (!local) return require(name)
      return load(['', '.tsx', '.ts', '/index.ts'].map(ext => local + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()))
    }
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return mod.exports
  }
  return file => load(path.join(root, file))
}

test('sales transport sends server-side payment and optional full-summary parameters', async () => {
  let url
  const response = { items: [], summary: { totalSales: 0 } }
  const { fetchSales } = loader({ './api': { apiFetch: async value => { url = value; return response } } })('src/services/salesService.ts')
  assert.equal(await fetchSales({ payment: 'Crédito 30 días', includeSummary: true, page: 2, pageSize: 20 }), response)
  const params = new URL(url, 'https://example.test').searchParams
  assert.equal(params.get('payment'), 'Crédito 30 días')
  assert.equal(params.get('includeSummary'), 'true')
  assert.equal(params.get('page'), '2')
  await fetchSales({ includeSummary: false })
  assert.equal(new URL(url, 'https://example.test').searchParams.has('includeSummary'), false)
})

function hookProbe(change, failed = false) {
  const calls = []
  let output
  const query = params => {
    calls.push(params)
    return { data: failed ? undefined : params.includeSummary ? {
      items: [], summary: { totalSales: 5010, transactionCount: 502, averageTicket: 5010 / 502, preferredPaymentMethod: 'Crédito 30 días' },
    } : { items: [{ id: 'credit-sale', total: 25, adjusted_total: 0, payment_method: { name: 'Crédito 30 días', is_credit: true } }], page: 1, pageSize: 10, totalItems: 23, totalPages: 3, hasMore: true },
    isLoading: false, isFetching: false, isError: failed, error: failed ? new Error('Servicio no disponible') : null, refetch() {} }
  }
  const { useSalesData } = loader({ '@/hooks/useSales': { useSales: query, useSalesByStatus: (status, params) => query({ ...params, status }) } })('src/modules/sales/hooks/useSalesData.ts')
  let changed = false
  function Probe() {
    output = useSalesData()
    if (change && !changed) { changed = true; change(output) }
    return null
  }
  renderToStaticMarkup(React.createElement(Probe))
  return { calls, output }
}

test('one paginated list and one aggregate summary replace split lists and 500-row KPIs', () => {
  const { calls, output } = hookProbe()
  assert.equal(calls.length, 2)
  assert.equal(calls[0].status, undefined)
  assert.equal(calls[0].pageSize, 10)
  assert.deepEqual(calls[1], { status: 'Completada', period: 'today', page: 1, pageSize: 1, includeSummary: true })
  assert.equal(output.sales.length, 1)
  assert.equal(output.sales[0].adjustedTotal, 0)
  assert.equal(output.totalSalesToday, 5010)
  assert.equal(output.transactionCountToday, 502)
  assert.equal(output.pageInfo.totalItems, 23)
})

test('status and payment changes are sent to the server rather than filtering a page locally', () => {
  const { calls, output } = hookProbe(data => { data.setStatusFilter('cancelled'); data.setPaymentFilter('Efectivo'); data.setPageSize(20) })
  const list = calls.at(-2)
  assert.equal(list.status, 'Cancelada')
  assert.equal(list.payment, 'Efectivo')
  assert.equal(list.page, 1)
  assert.equal(list.pageSize, 20)
  assert.equal(output.sales.length, 1)
  assert.equal(calls.at(-1).status, 'Completada')
  assert.equal(calls.at(-1).payment, undefined)
})

test('list and summary failures are explicit, not a successful empty result', () => {
  const { output } = hookProbe(null, true)
  assert.equal(output.error, 'Servicio no disponible')
  assert.equal(output.summaryError, true)
})

test('short or debouncing searches do not show cached rows or unrelated page totals', () => {
  for (const value of ['ab', 'Cliente']) {
    const { output } = hookProbe(data => data.setSearchTerm(value))
    assert.deepEqual(output.sales, [])
    assert.equal(output.pageInfo.totalItems, null)
    assert.equal(output.pageInfo.hasMore, false)
    assert.equal(output.isLoading, value === 'Cliente')
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = name => {
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return require(name)
    return load(['', '.tsx', '.ts', '.js', '/index.ts'].map(ext => local + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()))
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
  return mod.exports
}

test('sales loading keeps column headings and never presents an empty result before the response', () => {
  const { SalesStatusTable } = load(path.join(root, 'src/modules/sales/components/SalesStatusTable.tsx'))
  const props = { statusKey: 'completed', sales: [], pageInfo: { page: 1, totalPages: null, hasMore: false }, isLoading: true, updatingSaleIds: new Set(), onPageChange() {}, onStatusChange() {}, onViewSale() {}, onViewInvoice() {}, canChangeStatus: false, canViewDetail: false, canViewInvoice: false }
  const initial = renderToStaticMarkup(React.createElement(SalesStatusTable, props))
  assert.match(initial, /<th[^>]*>ID Venta<\/th>/)
  assert.match(initial, /role="status"/)
  assert.equal((initial.match(/<td\b/g) ?? []).length, 41, 'Five skeleton rows must have eight cells each, plus the loading status cell')
  assert.doesNotMatch(initial, /No hay ventas/)

  const refreshing = renderToStaticMarkup(React.createElement(SalesStatusTable, { ...props, isLoading: false, isFetching: true, sales: [{ id: 'sale-1', reference: 'V-001', customer: 'Cliente visible', date: '2026-10-06T12:00:00Z', status: 'completed', payment: 'Efectivo', items: 1, total: 25 }] }))
  assert.match(refreshing, /Cliente visible/)
  assert.match(refreshing, /role="status"/)
  assert.equal((refreshing.match(/<td\b/g) ?? []).length, 8, 'Refetching must retain the real sale instead of skeletons')
})

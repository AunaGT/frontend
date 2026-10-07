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
const { StaticRouter } = require('react-router-dom/server')
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = name => {
    if (name.endsWith('.css')) return {}
    if (name === '@/hooks/useAuthPermissions') return { useAuthPermissions: () => ({ hasPermission: () => true }) }
    if (name === '@/hooks/useSystemSettings') return { useSystemSettings: () => ({ locale: 'es-GT' }) }
    if (name === '@/services/api') return { apiFetch: () => Promise.resolve({ data: [], total: 0 }) }
    const local = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return require(name)
    return load(['', '.tsx', '.ts', '.js', '/index.ts'].map(ext => local + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()))
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
  return mod.exports
}

test('inventory count loading keeps headings and refresh keeps the visible session', () => {
  const { default: InventoryCountListPage } = load(path.join(root, 'src/modules/inventory-count/pages/InventoryCountListPage.tsx'))
  const client = new QueryClient()
  const render = () => renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(StaticRouter, { location: '/inventario/inventariado' }, React.createElement(InventoryCountListPage))))
  const initial = render()
  assert.match(initial, /<th[^>]*>Sesión<\/th>/)
  assert.match(initial, /aria-label="Buscar sesiones"/)
  assert.match(initial, /class="sr-only">Sesiones de conteo<\/h1>/)
  assert.match(initial, /compact-filter-actions[\s\S]*Crear sesión/)
  assert.match(initial, /role="status"/)
  assert.equal((initial.match(/<td\b/g) ?? []).length, 36, 'Five skeleton rows need seven cells each, plus the status cell')
  assert.doesNotMatch(initial, /No hay sesiones/)

  client.setQueryData(['inventory-sessions', 'all', '', 1], { total: 1, data: [{ id: 'session-1', name: 'Conteo visible', status: 'DRAFT', scope_json: null, dual_approval: false, submit_reason: null, first_approved_at: null, first_approval_reason: null, final_approval_reason: null, notes: null, created_at: '2026-10-06T12:00:00Z', started_at: null, submitted_at: null, approved_at: null, cancelled_at: null, cancel_reason: null, createdBy: { id: 'user-1', name: 'Responsable', email: 'example@example.com' }, progress: { totalLines: 10, countedLines: 0, pct: 0 } }] })
  const refreshing = render()
  assert.match(refreshing, /Conteo visible/)
  assert.match(refreshing, /role="status"/)
  assert.equal((refreshing.match(/<td\b/g) ?? []).length, 7, 'Refetching keeps the real row')
  client.clear()
})

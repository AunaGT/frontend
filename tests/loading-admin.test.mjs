import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '../src')
let queryState
const overrides = new Map([
  ['@/services/api', { apiFetch: () => { throw new Error('Remote calls are disabled in render tests') } }],
  ['./api', { apiFetch: () => { throw new Error('Remote calls are disabled in render tests') } }],
  ['@/services/userService', {}],
  ['@tanstack/react-query', { useQuery: options => options.queryKey[0] === 'users-role-options' ? { data: [] } : queryState, useMutation: () => ({ isPending: false }), useQueryClient: () => ({}) }],
  ['react-router-dom', { ...require('react-router-dom'), useNavigate: () => () => {} }],
  ['@/context/useTenant', { useTenant: () => ({ company: { id: 'c1' }, branches: [], companies: [] }) }],
  ['@/hooks/useAuthPermissions', { useAuthPermissions: () => ({ hasPermission: () => true }) }],
  ['@/hooks/use-toast', { useToast: () => ({ toast: () => {} }) }],
])
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = name => {
    if (overrides.has(name)) return overrides.get(name)
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return require(name)
    const resolved = ['', '.tsx', '.ts', '.mjs', '.js', '/index.tsx'].map(ext => local + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile())
    return load(resolved)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
  return mod.exports
}

test('employee list keeps search and real table headings visible during its initial load', () => {
  queryState = { isLoading: true, isFetching: true, isError: false }
  const Employees = load(path.join(root, 'modules/hr/pages/EmployeesManagement.tsx')).default
  const html = renderToStaticMarkup(React.createElement(Employees))
  assert.match(html, /id="hr-search"/)
  assert.match(html, /<th[^>]*>Empleado<\/th>/)
  assert.match(html, /role="status"/)
  assert.ok((html.match(/<td /g) || []).length >= 35, 'Initial loading must reserve the five cell-level employee rows')
})

test('employee list preserves records and announces a background refresh', () => {
  queryState = { isLoading: false, isFetching: true, isError: false, data: { items: [{ id: 'e1', first_name: 'Ana', last_name: 'López', code: 'E1', hire_date: '2026-01-01', status: 'ACTIVO' }], page: 1, totalPages: 1, totalItems: 1 } }
  const Employees = load(path.join(root, 'modules/hr/pages/EmployeesManagement.tsx')).default
  const html = renderToStaticMarkup(React.createElement(Employees))
  assert.match(html, /Ana López/)
  assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /data-loading-skeleton/)
})

test('user list retains its seven table headings and search while loading', () => {
  queryState = { isLoading: true, isFetching: true }
  const Users = load(path.join(root, 'modules/users/UserManagement.tsx')).default
  const html = renderToStaticMarkup(React.createElement(require('react-router-dom/server').StaticRouter, { location: '/' }, React.createElement(Users)))
  assert.match(html, /aria-label="Buscar usuarios"/)
  assert.match(html, /<th>Último acceso<\/th>/)
  assert.match(html, /role="status"/)
  assert.ok((html.match(/<td /g) || []).length >= 35)
})

test('payroll initial loading remains within the real nine-column table', () => {
  queryState = { isLoading: true, isFetching: true }
  const Payroll = load(path.join(root, 'modules/payroll/pages/PayrollRunsManagement.tsx')).default
  const html = renderToStaticMarkup(React.createElement(require('react-router-dom/server').StaticRouter, { location: '/' }, React.createElement(Payroll)))
  assert.match(html, /<th[^>]*>Fecha de pago<\/th>/)
  assert.match(html, /role="status"/)
  assert.ok((html.match(/<td /g) || []).length >= 45)
})

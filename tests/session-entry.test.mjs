import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '..')
let auth
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  cache.set(file, mod)
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = name => {
    if (name === '@/context/useAuth') return { useAuth: () => auth }
    if (name.endsWith('.css')) return {}
    const local = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
    if (!local) return require(name)
    return load(['', '.tsx', '.ts', '.js', '/index.tsx'].map(ext => local + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()))
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
  return mod.exports
}
const { default: PrivateRoute } = load(path.join(root, 'src/routes/PrivateRoute.tsx'))
let mounted
function ProtectedContent() { mounted++; return React.createElement('p', null, 'Expediente privado') }
function renderEntry(state, url = '/') {
  auth = state; mounted = 0
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Routes, null,
    React.createElement(Route, { element: React.createElement(PrivateRoute) }, React.createElement(Route, { path: '*', element: React.createElement(ProtectedContent) })),
    React.createElement(Route, { path: '/login', element: React.createElement('p', null, 'Login') }),
  )))
}

test('session verification uses the home structure without mounting private content or exposing cached identity', () => {
  for (const url of ['/', '/ventas/123/factura']) {
    const html = renderEntry({ isLoading: true, isAuthenticated: true, user: { name: 'Nombre privado en caché' } }, url)
    assert.match(html, /aria-label="Inicio"/)
    assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /Verificando tu sesión|Nombre privado|Expediente privado/)
    assert.equal(mounted, 0)
  }
})

test('resolved authentication and mandatory-password guards remain enforced', () => {
  assert.doesNotMatch(renderEntry({ isLoading: false, isAuthenticated: false, user: null }), /Expediente privado/)
  assert.equal(mounted, 0)
  assert.doesNotMatch(renderEntry({ isLoading: false, isAuthenticated: true, user: { must_change_password: true } }, '/ventas'), /Expediente privado/)
  assert.equal(mounted, 0)
  assert.match(renderEntry({ isLoading: false, isAuthenticated: true, user: { must_change_password: false } }, '/ventas'), /Expediente privado/)
  assert.equal(mounted, 1)
  assert.match(renderEntry({ isLoading: false, isAuthenticated: true, user: { must_change_password: true } }, '/cambiar-contrasena'), /Expediente privado/)
})

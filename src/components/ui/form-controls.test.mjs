import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react-swc'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import tailwind from 'tailwindcss'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': path.join(root, 'src') } }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
test.after(() => server.close())
const load = name => server.ssrLoadModule(`/src/components/ui/${name}.tsx`)
const html = (Component, props) => renderToStaticMarkup(createElement(Component, props))

// Compare normal, compound selectors against the real compiled Preflight and utilities.
// Stateful/ancestor selectors are outside these plain-field regressions, not a browser substitute.
function matches(selector, tag, classes) {
  return selector.nodes.every(node => {
    if (node.type === 'tag') return node.value === tag
    if (node.type === 'universal') return true
    if (node.type === 'class') return classes.includes(node.value)
    if (node.type === 'pseudo' && [':where', ':is'].includes(node.value)) return node.nodes.some(child => matches(child, tag, classes))
    return false
  })
}
function weight(selector) {
  return selector.nodes.reduce((total, node) => total + (node.type === 'class' ? 100 : node.type === 'tag' ? 1 : node.type === 'pseudo' && node.value === ':is' ? Math.max(...node.nodes.map(weight)) : 0), 0)
}
async function compiledControls() {
  const { default: config } = await server.ssrLoadModule('/tailwind.config.ts')
  const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8') + '\n' + fs.readFileSync(new URL('./form-controls.css', import.meta.url), 'utf8')
  return postcss([tailwind({ ...config, content: [{ raw: 'pl-10 px-2 text-destructive', extension: 'html' }] })]).process(css, { from: undefined })
}
function winningDeclaration(css, tag, classes, properties) {
  let result
  css.root.walkRules(rule => {
    if (rule.parent.type === 'atrule') return
    for (const selector of selectorParser().astSync(rule.selector).nodes) {
      if (!matches(selector, tag, classes)) continue
      const specificity = weight(selector)
      rule.walkDecls(decl => {
        if (properties.includes(decl.prop) && (!result || specificity >= result.specificity)) result = { value: decl.value, specificity }
      })
    }
  })
  return result?.value
}

test('plain controls keep inner spacing after Preflight while icon and compact padding still wins', async () => {
  const css = await compiledControls()
  for (const tag of ['input', 'textarea', 'select', 'button']) assert.equal(winningDeclaration(css, tag, ['auna-control'], ['padding', 'padding-left', 'padding-inline']), '0 12px', tag)
  assert.equal(winningDeclaration(css, 'input', ['auna-control', 'pl-10'], ['padding', 'padding-left', 'padding-inline']), '2.5rem')
  assert.equal(winningDeclaration(css, 'input', ['auna-control', 'px-2'], ['padding', 'padding-left', 'padding-inline']), '0.5rem')
})

test('orange primary actions have white text as both buttons and navigation links', async () => {
  const css = await compiledControls()
  for (const tag of ['button', 'a']) {
    for (const cls of ['auna-form-action-primary', 'btn-auna-primary']) {
      assert.equal(winningDeclaration(css, tag, [cls], ['color']), 'white', `${tag}.${cls}`)
      assert.match(winningDeclaration(css, tag, [cls], ['background', 'background-color']), /--brand-orange/, `${tag}.${cls}`)
    }
    assert.match(winningDeclaration(css, tag, ['auna-form-action-primary', 'text-destructive'], ['color']), /--destructive/)
  }
})

test('numeric fields hide platform spinners without changing their native constraints', async () => {
  const { Input } = await load('input')
  const field = html(Input, { type: 'number', min: 1, max: 99, step: 0.5, 'aria-label': 'Muestra' })
  assert.match(field, /type="number"/)
  assert.match(field, /min="1" max="99" step="0.5"/)
  const css = postcss.parse(fs.readFileSync(new URL('./form-controls.css', import.meta.url), 'utf8'))
  const rules = new Map()
  css.walkRules(rule => rules.set(rule.selector, Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]))))
  assert.ok([...rules].some(([selector, declarations]) => selector.includes('[type="number"]') && declarations.appearance === 'textfield'))
  assert.ok([...rules].some(([selector, declarations]) => selector.includes('::-webkit-inner-spin-button') && declarations['-webkit-appearance'] === 'none'))
})

test('text and multiline controls share presentation without losing native attributes', async () => {
  const { Input } = await load('input')
  const { Textarea } = await load('textarea')
  const field = html(Input, { id: 'qty', name: 'qty', type: 'number', min: 1, max: 10, step: 1, disabled: true })
  assert.match(field, /auna-control/)
  assert.match(field, /id="qty"/)
  assert.match(field, /name="qty"/)
  assert.match(field, /type="number"/)
  assert.match(field, /min="1"/)
  assert.match(field, /max="10"/)
  assert.match(field, /disabled/)
  assert.match(html(Textarea, { maxLength: 500, rows: 4 }), /auna-control-textarea/)
})

test('global entry loads themed native controls independently of lazy modules', async () => {
  const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8')
  assert.match(main, /import ['"]\.\/components\/ui\/form-controls\.css['"]/)
  const css = await postcss().process(fs.readFileSync(new URL('./form-controls.css', import.meta.url), 'utf8'), { from: undefined })
  const rules = new Map()
  css.root.walkRules(rule => rules.set(rule.selector, Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]))))
  assert.equal(rules.get(':root')['--auna-control-height'], '40px')
  assert.notEqual(rules.get(':root')['--auna-control-bg'], rules.get('.dark')['--auna-control-bg'])
  assert.ok([...rules].some(([selector, declarations]) => selector.includes('.auna-receipt-select') && declarations.border))
  assert.ok([...rules].some(([selector, declarations]) => selector.includes(':focus-visible') && declarations.outline?.includes('--auna-control-focus')))
  assert.ok([...rules].some(([selector, declarations]) => selector.includes(':disabled') && declarations.background?.includes('--auna-control-disabled')))
})

test('selection controls retain semantic state and the common appearance', async () => {
  for (const [file, name, contract] of [['checkbox', 'Checkbox', 'auna-checkbox'], ['switch', 'Switch', 'auna-switch']]) {
    const component = (await load(file))[name]
    const field = html(component, { checked: true, disabled: true, 'aria-label': 'Disponible' })
    assert.match(field, new RegExp(contract))
    assert.match(field, /aria-checked="true"/)
    assert.match(field, /disabled/)
  }
  const { Select, SelectTrigger, SelectValue } = await load('select')
  const field = renderToStaticMarkup(createElement(Select, { value: 'a' }, createElement(SelectTrigger, { 'aria-label': 'Tipo' }, createElement(SelectValue))))
  assert.match(field, /auna-control/)
})

test('readonly error and explicit success are represented without inferring validation from a value', async () => {
  const { Input } = await load('input')
  const field = html(Input, { value: 'ABC', readOnly: true, 'aria-invalid': true, 'aria-describedby': 'ref-error' })
  assert.match(field, /auna-control/)
  assert.match(field, /readonly/)
  assert.match(field, /aria-invalid="true"/)
  assert.match(field, /aria-describedby="ref-error"/)
  assert.doesNotMatch(field, /data-validation="success"/)
  assert.match(html(Input, { value: 'ABC', readOnly: true, 'data-validation': 'success' }), /data-validation="success"/)
})

test('composed searches and validation messages use the same contract', async () => {
  const { IconInput } = await load('icon-input')
  const { Search } = await import('lucide-react')
  const field = html(IconInput, { id: 'sku', label: 'SKU', icon: Search, error: 'Código duplicado' })
  assert.match(field, /auna-field-message/)
  assert.match(field, /data-status="error"/)
  assert.match(field, /aria-describedby="sku-error"/)
  assert.match(field, /role="alert"/)
  const { Command, CommandInput } = await load('command')
  const search = renderToStaticMarkup(createElement(Command, {}, createElement(CommandInput, { 'aria-label': 'Buscar producto' })))
  assert.match(search, /auna-control-group/)
  assert.match(search, /auna-control-menu/)
})

test('form action defaults do not override explicit semantic colours', async () => {
  const { Button } = await load('button')
  const field = html(Button, { variant: 'outline', className: 'border-destructive text-destructive', children: 'Rechazar' })
  assert.match(field, /border-destructive text-destructive/)
  const css = fs.readFileSync(new URL('./form-controls.css', import.meta.url), 'utf8')
  const selectors = []
  postcss.parse(css).walkRules(rule => selectors.push(...selectorParser().astSync(rule.selector).nodes.map(node => node.toString().trim())))
  assert.ok(selectors.includes(':where(.auna-form-action-outline)'))
  assert.ok(selectors.includes(':where(.auna-form-action-primary)'))
})

test('no active native field is left outside the shared control contract', () => {
  const missing = []
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(file); continue }
      if (!file.endsWith('.tsx') || file.includes('.EXAMPLE.')) continue
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      function visit(node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(source)
          if (tag === 'div' && node.attributes.getText(source).includes('auna-input') && !node.attributes.getText(source).includes('auna-field-value')) missing.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} legacy readonly value`)
          if (['input', 'select', 'textarea', 'output'].includes(tag)) {
            const attrs = node.attributes.properties.filter(ts.isJsxAttribute)
            const value = name => attrs.find(a => a.name.getText(source) === name)?.initializer?.getText(source) ?? ''
            const type = value('type')
            const cls = value('className')
            if (/^['"]hidden['"]$/.test(type) || (/^['"]file['"]$/.test(type) && /\b(sr-only|hidden)\b/.test(cls))) return
            if (!/auna-(control|checkbox|radio|file|field-value|receipt-select)/.test(cls)) missing.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${tag}`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  walk(path.join(root, 'src'))
  assert.deepEqual(missing, [], `Native fields without shared presentation:\n${missing.join('\n')}`)
})

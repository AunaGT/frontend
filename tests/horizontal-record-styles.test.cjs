const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const postcss = require('postcss')
const css = postcss.parse(fs.readFileSync(path.join(__dirname, '../src/components/shared/surfaces.css'), 'utf8'))
function declarations(selector, mobile = false) {
  const result = {}
  css.walkRules(rule => {
    if (rule.selector !== selector || (rule.parent.type === 'atrule') !== mobile) return
    rule.walkDecls(d => { result[d.prop] = d.value })
  })
  return result
}

test('record layouts keep media optional and horizontal at both widths', () => {
  assert.equal(declarations('.auna-record-card').display, 'flex')
  assert.equal(declarations('.auna-record-card', true)['flex-direction'], undefined)
  assert.equal(declarations('.auna-record-content').flex, '1')
  assert.equal(declarations('.auna-record-content')['min-width'], '0')
  assert.equal(declarations('.auna-record-media').width, '64px')
  assert.equal(declarations('.auna-record-card').padding, '12px')
  assert.equal(declarations('.auna-record-media')['align-self'], 'stretch')
  assert.equal(declarations('.auna-record-media > img').height, '100%')
  assert.equal(declarations('.auna-record-media > img')['object-fit'], 'contain')
  // Actual column widths and final-row behavior are exercised by visual/fluid-layout.electron.cjs.
})

test('side labels wrap rather than overflowing compact cards and keyboard focus remains visible', () => {
  const label = declarations('.auna-record-side > *')
  assert.equal(label['max-width'], '100%')
  assert.equal(label['white-space'], 'normal')
  assert.equal(declarations(':is(.auna-record-card, .auna-record-interactive):is(button, [role="button"]):focus-visible').outline, '2px solid hsl(var(--ring))')
})

test('record cards inherit the same raised surface and readable secondary text in both themes', () => {
  for (const theme of [':root', '.dark']) {
    assert.ok(declarations(theme)['--auna-surface-card'])
    assert.ok(declarations(theme)['--auna-surface-muted'])
  }
  assert.equal(declarations('.auna-surface').background, 'hsl(var(--auna-surface-card))')
  assert.equal(declarations('.auna-record-card').background, undefined)
})

const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { resolveBase } = require('../../deposito-backend/src/modules/config/customerPages/bases')
const compile = input => require('../../deposito-backend/src/modules/config/customerPages/pageSource').compilePageSource(input)
test('full-width page settings survive visual editing and a complete source round trip', async () => {
  const { serializePageSource } = loadReportModule('../config/customerPages/pageSource.ts')
  const design = resolveBase('QUOTE')
  design.theme = { ...design.theme, contentWidth: 'full', padding: 0 }
  const source = serializePageSource(design)
  assert.match(source.css, /-auna-content-width: full/)
  assert.match(source.css, /padding: 0px/)
  assert.deepEqual(await compile({ ...source, baseDesign: design }), design)
})
test('whole page HTML and responsive CSS round-trip all six existing designs', async () => {
  const { serializePageSource } = loadReportModule('../config/customerPages/pageSource.ts')
  for (const type of ['QUOTE', 'ORDER']) for (const base of ['CLASSIC', 'CATALOG', 'SERVICES']) {
    const design = resolveBase(type, base)
    design.nodes[0].styles.mobile = { padding: 16, fontSize: 20 }
    const source = serializePageSource(design)
    assert.match(source.html, /<auna-items/)
    assert.match(source.html, /<auna-summary/)
    assert.deepEqual(await compile({ ...source, baseDesign: design }), design)
  }
})
test('source preserves rich content, resources, conditions and inert custom code', async () => {
  const { serializePageSource } = loadReportModule('../config/customerPages/pageSource.ts')
  const design = resolveBase('QUOTE', 'SERVICES')
  const blank = { desktop: {}, tablet: {}, mobile: {} }
  design.resources.photo = { assetId: '', alt: 'A & B' }
  design.customBlocks.visual = { html: '<b>Decoración</b>', css: '', js: 'throw Error("never execute")', fallbackText: 'Visual' }
  design.nodes.push(...[
    { id: 'image', type: 'Image', props: { resource: 'photo', caption: 'A "quote" <b>' } },
    { id: 'rich', type: 'Text', props: { document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola', marks: [{ type: 'bold' }] }] }] } } },
    { id: 'visual', type: 'CustomVisual', props: { blockId: 'visual' } },
  ].map(n => ({ ...n, styles: blank, visibility: { states: ['SENT'] }, children: [] })))
  const source = serializePageSource(design)
  assert.doesNotMatch(source.html, /throw Error|<script/)
  assert.deepEqual(await compile({ ...source, baseDesign: design }), design)
})

const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const { resolveBase } = require('../../deposito-backend/src/modules/config/customerPages/bases')
const load = () => loadReportModule('../config/customerPages/PageSourceDraft.ts').PageSourceDraft
test('opening source is inert and applying makes one accepted design change', async () => {
  const Source = load(), design = resolveBase('QUOTE'), session = new Source(design), applied = []
  let current = design
  assert.equal(session.dirty, false)
  session.edit({ ...session.source, html: session.source.html.replace('Tu propuesta','Oferta') })
  const compiled = structuredClone(design); compiled.nodes[0].props.title = 'Oferta'
  assert.equal(await session.apply(async () => compiled, () => current, next => { current = next; applied.push(next); return true }), true)
  assert.equal(applied.length, 1); assert.equal(session.dirty, false)
})
test('invalid source survives failure and the last valid design is never replaced', async () => {
  const Source = load(), design = resolveBase('QUOTE'), session = new Source(design)
  session.edit({ html: '<broken>', css: '' })
  await assert.rejects(() => session.apply(async () => { throw Error('Error de sintaxis') }, () => design, () => assert.fail('must not apply')))
  assert.equal(session.source.html, '<broken>'); assert.equal(session.dirty, true); assert.equal(session.busy, false)
})
test('late compilation cannot replace a newer source edit or external design change', async () => {
  for(const external of [false,true]) {
    const Source = load(), design = resolveBase('QUOTE'), session = new Source(design)
    session.edit({ ...session.source, css: '' })
    let resolve, current = design
    const pending = session.apply(() => new Promise(r => resolve = r), () => current, () => assert.fail('stale apply'))
    if(external) current = { ...design, theme: { ...design.theme, accent: '#123456' } }
    else session.edit({ ...session.source, css: '#n-1 {padding: 20px;}' })
    resolve(design)
    assert.equal(await pending, false); assert.equal(session.dirty, true)
  }
})
test('a buffer based on an older external design refuses to compile over that newer document', async () => {
  const Source = load(), design = resolveBase('QUOTE'), session = new Source(design)
  session.edit({ ...session.source, css: '' })
  const newer = { ...design, theme: { ...design.theme, accent: '#123456' } }
  assert.equal(await session.apply(() => assert.fail('must not compile a stale base'), () => newer, () => assert.fail('must not overwrite')), false)
  assert.equal(session.dirty, true)
})
test('applying source keeps the accepted pruned document as the next compilation baseline', async () => {
  const Source = load(), commands = loadReportModule('../config/customerPages/editorState.ts')
  const design = resolveBase('QUOTE')
  design.resources.photo = { assetId: '', alt: 'Foto' }
  design.nodes.push({ id: 'photo', type: 'Image', props: { resource: 'photo' }, styles: { desktop: {}, tablet: {}, mobile: {} }, visibility: {}, children: [] })
  let editor = commands.createEditorState(design)
  const session = new Source(design)
  session.edit({ ...session.source, html: session.source.html.replace(/.*<auna-image[^\n]*\n/, '') })
  const compiled = structuredClone(design); compiled.nodes.pop()
  const accept = next => { editor = commands.applyPortalCommand(editor, { type: 'replace', design: next }); return true }
  assert.equal(await session.apply(async () => compiled, () => editor.design, accept), true)
  assert.deepEqual(editor.design.resources, {})
  session.edit({ ...session.source, css: session.source.css + '\n/* otra edición */' })
  assert.equal(await session.apply(async (_text, base) => base, () => editor.design, accept), true)
  assert.equal(session.dirty, false)
  const undone = commands.undoPortalCommand(commands.undoPortalCommand(editor))
  assert.ok(undone.design.resources.photo)
})

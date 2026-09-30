import assert from 'node:assert/strict'
import test from 'node:test'
import { getDialogAppearance } from './dialogAppearance.mjs'

test('mantiene intacta la apariencia predeterminada', () => {
  assert.deepEqual(getDialogAppearance(), {
    overlay: undefined,
    content: undefined,
    close: undefined,
  })
})

test('la apariencia Auna limita el panel, usa la marca y adapta sus acciones', () => {
  const appearance = getDialogAppearance('auna', 'dialog')

  assert.match(appearance.overlay, /backdrop-blur/)
  assert.match(appearance.content, /calc\(100vw-2rem\)/)
  assert.match(appearance.content, /calc\(100dvh-2rem\)/)
  assert.match(appearance.content, /--primary:var\(--brand-orange\)/)
  assert.match(appearance.content, /data-slot=dialog-header/)
  assert.match(appearance.content, /data-slot=dialog-footer/)
  assert.match(appearance.close, /size-10/)
})

test('la confirmación Auna conserva el mismo lienzo con sus propios slots', () => {
  const appearance = getDialogAppearance('auna', 'alert')

  assert.match(appearance.content, /data-slot=alert-dialog-header/)
  assert.match(appearance.content, /data-slot=alert-dialog-footer/)
  assert.equal(appearance.close, undefined)
})

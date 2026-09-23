import assert from 'node:assert/strict'
import test from 'node:test'

const moduleUrl = new URL('../src/modules/transfers/transferViewModel.ts', import.meta.url)

test('elige una sola vista y usa cuadros inicialmente en móvil', async () => {
  const { initialTransferView, visibleTransferViews } = await import(moduleUrl)

  assert.equal(initialTransferView(767), 'cards')
  assert.equal(initialTransferView(768), 'table')
  assert.deepEqual(visibleTransferViews('table'), { table: true, cards: false })
  assert.deepEqual(visibleTransferViews('cards'), { table: false, cards: true })
})

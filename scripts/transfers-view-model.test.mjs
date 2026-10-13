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

test('crea la paginación compacta del diseño', async () => {
  const { transferPaginationItems } = await import(moduleUrl)

  assert.deepEqual(transferPaginationItems(1, 19), [1, 2, 3, 4, 5, 'ellipsis', 19])
  assert.deepEqual(transferPaginationItems(10, 19), [1, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 19])
  assert.deepEqual(transferPaginationItems(19, 19), [1, 'ellipsis', 15, 16, 17, 18, 19])
  assert.deepEqual(transferPaginationItems(1, 4), [1, 2, 3, 4])
})

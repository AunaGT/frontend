import assert from 'node:assert/strict'
import test from 'node:test'

test('preserva la imagen del producto y acumula la cantidad sin duplicar líneas', async () => {
  let draft = {}
  try {
    draft = await import('./orderDraft.mjs')
  } catch {
    // La primera ejecución debe fallar por contrato, antes de implementar el helper.
  }

  assert.equal(typeof draft.addOrderDraftLine, 'function')

  const product = {
    id: 'prod-1',
    name: 'Café molido',
    barcode: '7400001',
    imageUrl: '/uploads/cafe.webp',
    price: 42.5,
    stock: 8,
  }
  const first = draft.addOrderDraftLine([], product)
  const second = draft.addOrderDraftLine(first, product)

  assert.deepEqual(second, [{
    product_id: 'prod-1',
    name: 'Café molido',
    barcode: '7400001',
    imageUrl: '/uploads/cafe.webp',
    unitPrice: 42.5,
    stock: 8,
    qty: 2,
  }])
})

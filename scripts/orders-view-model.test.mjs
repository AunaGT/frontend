import assert from 'node:assert/strict'
import test from 'node:test'

const moduleUrl = new URL('../src/modules/orders/ordersViewModel.ts', import.meta.url)

test('deriva estados visuales reales y progreso del pedido', async () => {
  const { orderVisualState, orderProgressStep } = await import(moduleUrl)

  assert.deepEqual(orderVisualState('DRAFT'), { preparation: 'pending', delivery: 'pending' })
  assert.deepEqual(orderVisualState('CONFIRMED'), { preparation: 'preparing', delivery: 'pending' })
  assert.deepEqual(orderVisualState('PARTIALLY_FULFILLED'), { preparation: 'ready', delivery: 'transit' })
  assert.deepEqual(orderVisualState('FULFILLED'), { preparation: 'ready', delivery: 'delivered' })
  assert.equal(orderProgressStep('DRAFT'), 1)
  assert.equal(orderProgressStep('CONFIRMED'), 3)
  assert.equal(orderProgressStep('PARTIALLY_FULFILLED'), 4)
  assert.equal(orderProgressStep('FULFILLED'), 5)
  assert.equal(orderProgressStep('CANCELLED'), 0)
  assert.equal(orderProgressStep('EXPIRED'), 0)
})

test('genera un correo local para compartir el pedido', async () => {
  const { buildOrderMailto } = await import(moduleUrl)

  assert.match(
    buildOrderMailto('/p/token', 'PED-1', 'cliente@example.com'),
    /^mailto:cliente%40example\.com\?/
  )
  assert.match(buildOrderMailto('/p/token', 'PED-1'), /Pedido%20PED-1/)
})

test('crea paginación compacta', async () => {
  const { orderPaginationItems } = await import(moduleUrl)

  assert.deepEqual(orderPaginationItems(1, 12), [1, 2, 3, 4, 5, 'ellipsis', 12])
  assert.deepEqual(orderPaginationItems(6, 12), [1, 'ellipsis', 4, 5, 6, 7, 8, 'ellipsis', 12])
  assert.deepEqual(orderPaginationItems(12, 12), [1, 'ellipsis', 8, 9, 10, 11, 12])
})

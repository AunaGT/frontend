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

test('pagina partidas sin perder el total real', async () => {
  const { paginateOrderLines } = await import(moduleUrl)
  const lines = Array.from({ length: 23 }, (_, index) => ({ id: `line-${index + 1}` }))

  assert.deepEqual(paginateOrderLines(lines, 2, 10), {
    items: lines.slice(10, 20),
    page: 2,
    pageSize: 10,
    totalItems: 23,
    totalPages: 3,
  })
  assert.equal(paginateOrderLines(lines, 99, 10).page, 3)
})

test('calcula pagos del pedido desde ventas al contado y abonos', async () => {
  const { orderPaymentSummary } = await import(moduleUrl)

  assert.deepEqual(orderPaymentSummary(500, [
    { sale: { adjusted_total: 200, payment_status: 'PAID', paymentEntries: [] } },
    { sale: { adjusted_total: 250, payment_status: 'PARTIAL', paymentEntries: [{ amount: 75 }] } },
  ]), { invoiced: 450, unbilled: 50, paid: 275, balance: 175, percentage: 61 })
  assert.deepEqual(orderPaymentSummary(100, [
    { sale: { payment_status: 'PARTIAL', paymentEntries: [{ amount: -5 }] } },
  ]), { invoiced: 0, unbilled: 100, paid: 0, balance: 0, percentage: 0 })
  assert.deepEqual(orderPaymentSummary(1000, []), { invoiced: 0, unbilled: 1000, paid: 0, balance: 0, percentage: 0 })
  assert.equal(orderPaymentSummary(100, [{ sale: { adjusted_total: 100, payment_status: 'PAID', status: { name: 'Cancelada' } } }]).balance, 0)
})

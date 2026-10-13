import assert from 'node:assert/strict'
import test from 'node:test'
import {addOrderDraftLine,orderDraftTotal} from './orderDraft.mjs'
test('service draft preserves billing identity and rounds fractional line amounts exactly',()=>{
  const product={id:'s',name:'Asesoría',kind:'SERVICE',serviceUnitLabel:'Hora',quantityDecimals:2,price:19.99,stock:0}
  const lines=addOrderDraftLine([],product).map(line=>({...line,qty:'1.25'}))
  assert.equal(lines[0].kind,'SERVICE')
  assert.equal(lines[0].serviceUnitLabel,'Hora')
  assert.equal(orderDraftTotal(lines),24.99)
  assert.equal(addOrderDraftLine(lines,product)[0].qty,'2.25')
})

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
    qty: '2',kind:'STANDARD',serviceUnitLabel:undefined,quantityDecimals:0,
  }])
})

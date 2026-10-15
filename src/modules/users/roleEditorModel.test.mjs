import assert from 'node:assert/strict'
import { roleDraft } from './roleEditorModel.mjs'

assert.deepEqual(roleDraft({ name: 'Bodega', description: null, protected: true, permissions: [{ code: 'products.view' }] }), {
  name: 'Bodega', description: '', selected: ['products.view'],
})
assert.deepEqual(roleDraft({ name: 'Ventas', description: 'Caja', protected: false, permissions: [] }), {
  name: 'Ventas', description: 'Caja', selected: [],
})
console.log('Editor de roles: consultar no convierte el rol en una copia')

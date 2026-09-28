import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAlerts } from './alertsList.mjs'

const rows = [
  { id: 'a', title: 'Stock bajo', message: 'Poco inventario', product: 'Teclado', priority: 'critical', status: 'active', typeName: 'Stock bajo', localDate: '2026-09-27', timestampIso: '2026-09-27T17:00:00Z' },
  { id: 'b', title: 'Vencimiento', message: 'Lote', product: 'Arroz', priority: 'medium', status: 'resolved', typeName: 'Vencimiento', localDate: '2026-09-26', timestampIso: '2026-09-26T18:00:00Z' },
]

test('filtra alertas por texto, prioridad, estado, tipo y fecha local', () => {
  assert.deepEqual(filterAlerts(rows, { search: 'teclado', priority: 'critical', status: 'active', type: 'Stock bajo', from: '2026-09-27', to: '2026-09-27', order: 'newest' }).map((row) => row.id), ['a'])
  assert.deepEqual(filterAlerts(rows, { search: '', priority: 'all', status: 'all', type: 'all', from: '2026-09-28', to: '', order: 'newest' }), [])
})

test('ordena por fecha sin alterar la colección recibida', () => {
  const result = filterAlerts(rows, { search: '', priority: 'all', status: 'all', type: 'all', from: '', to: '', order: 'oldest' })
  assert.deepEqual(result.map((row) => row.id), ['b', 'a'])
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b'])
})

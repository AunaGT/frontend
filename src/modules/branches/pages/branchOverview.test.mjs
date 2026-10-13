import test from 'node:test'
import assert from 'node:assert/strict'
import { filterBranches, filterWarehouses } from './branchOverview.mjs'

test('filtra sucursales por responsable y estado sin perder la lista original', () => {
  const rows = [
    { name: 'Centro', code: 'CEN', state: 'operating', manager: { name: 'Ana Pérez' } },
    { name: 'Norte', code: 'NOR', state: 'maintenance', manager: { name: 'Luis Soto' } },
  ]
  assert.deepEqual(filterBranches(rows, { search: 'luis', status: 'maintenance', order: 'name' }).map((row) => row.code), ['NOR'])
  assert.equal(rows.length, 2)
})

test('filtra almacenes por sucursal, estado y texto', () => {
  const rows = [
    { name: 'Central', code: 'ALM-1', branch_id: 'a', active: true, branch: { name: 'Centro' }, locations: [] },
    { name: 'Respuestos', code: 'ALM-2', branch_id: 'b', active: false, branch: { name: 'Norte' }, locations: [] },
  ]
  assert.deepEqual(filterWarehouses(rows, { search: 'norte', branchId: 'b', status: 'inactive' }).map((row) => row.code), ['ALM-2'])
})

test('un almacén de sucursal inactiva no figura como operativo', () => {
  const rows = [{ name: 'Mixco', code: 'ALM-3', branch_id: 'c', active: true, branch: { name: 'Mixco', active: false }, locations: [] }]
  assert.deepEqual(filterWarehouses(rows, { search: '', branchId: 'all', status: 'active' }), [])
  assert.deepEqual(filterWarehouses(rows, { search: '', branchId: 'all', status: 'inactive' }).map((row) => row.code), ['ALM-3'])
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterRuns, filterPayslips, pageItems } from './payrollView.mjs'

test('filtra corridas por mes, estado y búsqueda sin perder la paginación', () => {
  const runs = [
    { name: 'Septiembre', code: 'N-1', pay_date: '2026-09-30', status: 'BORRADOR' },
    { name: 'Octubre', code: 'N-2', pay_date: '2026-10-31', status: 'PAGADA' },
    { name: 'Octubre bono', code: 'N-3', pay_date: '2026-10-15', status: 'BORRADOR' },
  ]
  assert.deepEqual(filterRuns(runs, { month: '10', status: 'BORRADOR', search: 'bono' }).map(({ code }) => code), ['N-3'])
  assert.deepEqual(pageItems(runs, 2, 2).map(({ code }) => code), ['N-3'])
})

test('filtra recibos por nombre, código y puesto', () => {
  const slips = [
    { employee: { first_name: 'Ana', last_name: 'López', code: 'E-1', position: 'Ventas' } },
    { employee: { first_name: 'Luis', last_name: 'Pérez', code: 'E-2', position: 'Bodega' } },
  ]
  assert.equal(filterPayslips(slips, 'bodega').length, 1)
  assert.equal(filterPayslips(slips, 'E-1').length, 1)
})

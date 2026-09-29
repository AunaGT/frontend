import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignImportField, feedbackForRow, readImportErrors } from './importRowFeedback.mjs'

test('matches Excel row numbers used by product and contact imports', () => {
  assert.deepEqual(feedbackForRow([{ rowIndex: 3, errors: ['Precio inválido'] }], 1, 2), ['Precio inválido'])
  assert.deepEqual(feedbackForRow([{ rowIndex: 3, errors: ['Precio inválido'] }], 0, 2), [])
})

test('matches one-based catalog and zero-based accounting errors', () => {
  assert.deepEqual(feedbackForRow([{ rowIndex: 1, errors: ['Duplicado'] }], 0, 1), ['Duplicado'])
  assert.deepEqual(feedbackForRow([{ rowIndex: 0, errors: ['Descuadrado'] }], 0, 0), ['Descuadrado'])
})

test('does not attach whole-file errors to an unrelated line', () => {
  assert.deepEqual(feedbackForRow([{ rowIndex: -1, errors: ['Sin conexión'] }], 0, 2), [])
})

test('reassigning a field removes its old column and prevents duplicate field mappings', () => {
  const mappings = [{ excelColumn: 'Nombre', systemField: 'name' }, { excelColumn: 'Descripción', systemField: null }]
  assert.deepEqual(assignImportField(mappings, 'name', 'Descripción'), [
    { excelColumn: 'Nombre', systemField: null },
    { excelColumn: 'Descripción', systemField: 'name' },
  ])
  assert.deepEqual(assignImportField(mappings, 'name', ''), [
    { excelColumn: 'Nombre', systemField: null },
    { excelColumn: 'Descripción', systemField: null },
  ])
})

test('preserves row errors returned when the import itself is rejected', () => {
  assert.deepEqual(readImportErrors({ invalidRows: [{ rowIndex: 2, errors: ['Duplicado'] }] }), [{ rowIndex: 2, errors: ['Duplicado'] }])
  assert.deepEqual(readImportErrors({ message: 'Error general' }), [])
})

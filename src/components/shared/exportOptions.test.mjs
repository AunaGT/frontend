import assert from 'node:assert/strict'
import { normalizeExportName } from './exportOptions.mjs'

assert.equal(normalizeExportName(' ventas / marzo .csv ', 'csv'), 'ventas-marzo.csv')
assert.equal(normalizeExportName('reporte.xlsx', 'pdf'), 'reporte.pdf')
assert.equal(normalizeExportName('   ', 'xlsx'), '')

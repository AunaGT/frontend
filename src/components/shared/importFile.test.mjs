import assert from 'node:assert/strict'
import { validateImportFile } from './importFile.mjs'

assert.equal(validateImportFile({ name: 'productos.xlsx', size: 100 }), null)
assert.match(validateImportFile({ name: 'productos.exe', size: 100 }), /XLSX/)
assert.match(validateImportFile({ name: 'productos.csv', size: 11 * 1024 * 1024 }), /10 MB/)

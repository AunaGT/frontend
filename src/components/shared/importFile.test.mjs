import assert from 'node:assert/strict'
import { validateImportFile } from './importFile.mjs'
import * as XLSX from 'xlsx'

assert.equal(validateImportFile({ name: 'productos.xlsx', size: 100 }), null)
assert.match(validateImportFile({ name: 'productos.exe', size: 100 }), /XLSX/)
assert.match(validateImportFile({ name: 'productos.csv', size: 11 * 1024 * 1024 }), /10 MB/)
const workbook = XLSX.read(Buffer.from('Nombre\nCafé revisión\n', 'utf8'), { type: 'array', codepage: 65001 })
assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])[0].Nombre, 'Café revisión')

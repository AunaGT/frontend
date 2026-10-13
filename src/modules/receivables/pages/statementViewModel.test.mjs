import assert from 'node:assert/strict'
import { statementMovements, statementDate, matchesStatementRow, receivablesCsvText } from './statementViewModel.mjs'

const statement = { resumen: { saldo: 70, credito_disponible: 20 }, ventas: [{ id: 'v1', date: '2026-09-01T12:00:00Z', total: 100, payment_status: 'PARTIAL', vencida: true }], cobros: [{ id: 'p1', paid_at: '2026-09-02T12:00:00Z', amount: 30, kind: 'PAYMENT' }, { id: 'p2', paid_at: '2026-09-03T12:00:00Z', amount: 20, kind: 'PAYMENT' }] }
const rows = statementMovements(statement)
assert.deepEqual(statementMovements({ resumen: { saldo: 3, credito_disponible: 0 }, ventas: [{ id: 'z', date: '2026-10-01T20:00:00Z', total: 4 }], cobros: [{ id: 'a', paid_at: '2026-10-01T20:00:00Z', amount: 1, kind: 'PAYMENT' }] }).map(row => row.balance), [4, 3])
assert.equal(statementDate('2026-10-09T05:59:59.999Z'), '2026-10-08')
assert.deepEqual(rows.map(row => row.balance), [100, 70, 50])
assert.equal(matchesStatementRow(rows[0], { from: '2026-09-01', to: '2026-09-01', kind: 'SALE', state: 'OVERDUE' }), true)
assert.equal(matchesStatementRow(rows[1], { kind: 'ALL', state: 'OVERDUE' }), false)
assert.equal(matchesStatementRow({ ...rows[0], date: '2026-09-02T01:00:00Z' }, { from: '2026-09-01', to: '2026-09-01', kind: 'ALL', state: 'ALL' }), true)
// Un historial acotado conserva el saldo inicial correspondiente a los movimientos anteriores.
assert.equal(statementMovements({ ...statement, ventas: [] }).at(-1).balance, 50)
assert.equal(receivablesCsvText([[' =SUM(A1)', 'Cliente; "uno"', -20]]), '\uFEFF\' =SUM(A1);"Cliente; ""uno""";-20')
console.log('Cartera: saldo acumulado, anticipos, fechas locales y CSV seguro verificados')

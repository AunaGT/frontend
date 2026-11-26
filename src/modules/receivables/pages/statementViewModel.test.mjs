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
import test from 'node:test'
test('reserved and refunded receipts never appear as fully applied to invoices',async()=>{
  const {paymentAllocationLabel}=await import('./statementViewModel.mjs')
  assert.equal(typeof paymentAllocationLabel,'function')
  assert.equal(paymentAllocationLabel({comprometido:40,devuelto:0,no_aplicado:0}),'Comprometido')
  assert.equal(paymentAllocationLabel({comprometido:0,devuelto:10,no_aplicado:0}),'Con devolución')
  assert.equal(paymentAllocationLabel({comprometido:0,devuelto:0,no_aplicado:5}),'Saldo a favor')
  assert.equal(paymentAllocationLabel({comprometido:0,devuelto:0,no_aplicado:0}),'Aplicado')
})
test('review holds do not invent an opening debt or reduce invoice debt as spendable advances',()=>{
  const rows=statementMovements({resumen:{saldo:75,credito_disponible:0},ventas:[{id:'sale',date:'2026-11-01',total:100}],
    cobros:[{id:'receipt',paid_at:'2026-11-02',amount:100,retenido:75,aplicado:25,no_aplicado:0,kind:'PAYMENT'}]})
  assert.deepEqual(rows.map(row=>row.balance),[100,75])
  assert.equal(rows[1].credit,25)
  assert.equal(rows[1].documentAmount,100)
})
test('a dispute charge is a separate document net of recoveries and the running balance still starts at zero',async()=>{
  const {chargeDocuments,documentKindLabel,CHARGE_KIND}=await import('./statementViewModel.mjs')
  const charge={id:'c1',tipo:'CARGO_CONTRACARGO',reference:'CC-PRIN-000001',date:'2026-11-10',due_date:'2026-12-10',total:60,abonado:20,recuperado:10,saldo:30,vencido:false,dias_vencido:0,dispute_id:'d1',referencia_proveedor:'CB-1',motivo:'Contracargo'}
  const statement={resumen:{saldo:30,credito_disponible:0,credito_recuperacion:5},ventas:[{id:'s1',date:'2026-11-01',total:100,payment_status:'PAID'}],
    cobros:[{id:'r1',paid_at:'2026-11-02',amount:100,kind:'PAYMENT'},{id:'r2',paid_at:'2026-11-12',amount:20,kind:'PAYMENT'}],
    cargos:[charge],creditos_recuperacion:[{id:'k1',origen:'Recuperación de contracargo',disponible:5,created_at:'2026-11-15'}]}
  const [doc]=chargeDocuments(statement)
  assert.equal(doc.documentType,CHARGE_KIND);assert.equal(doc.total,50,'net of what the bank returned or was forgiven');assert.equal(doc.payment_status,'PARTIAL')
  const rows=statementMovements(statement)
  assert.deepEqual(rows.map(r=>[r.kind,r.balance]),[['SALE',100],['PAYMENT',0],[CHARGE_KIND,50],['PAYMENT',30],['RECOVERY_CREDIT',25]])
  assert.equal(documentKindLabel(CHARGE_KIND),'Cargo por contracargo');assert.equal(matchesStatementRow(rows[2],{kind:CHARGE_KIND,state:'PARTIAL'}),true)
})

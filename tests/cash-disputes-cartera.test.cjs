const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('credit summary distinguishes spendable credit from a review hold without extra controls',()=>{
  const {CustomerCreditBalance}=loadReportModule('../receivables/components/CustomerCreditBalance.tsx')
  const html=renderToStaticMarkup(React.createElement(CustomerCreditBalance,{available:20,held:80,money:n=>`Q ${n.toFixed(2)}`}))
  for(const text of ['Disponible','Q 20.00','En revisión','Q 80.00'])assert.ok(html.includes(text),text)
  assert.equal(/<(input|button|textarea)\b/.test(html),false)
})
test('ordinary customer credit stays a single amount when there is no dispute hold',()=>{
  const {CustomerCreditBalance}=loadReportModule('../receivables/components/CustomerCreditBalance.tsx')
  const html=renderToStaticMarkup(React.createElement(CustomerCreditBalance,{available:100,money:n=>`Q ${n.toFixed(2)}`}))
  assert.ok(html.includes('Q 100.00'));assert.equal(html.includes('En revisión'),false)
})
test('a held receipt is labeled as under review instead of as fully applied',()=>{
  const {paymentAllocationLabel}=loadReportModule('../receivables/pages/statementViewModel.mjs')
  assert.equal(paymentAllocationLabel({retenido:75,no_aplicado:0,comprometido:25}),'En revisión')
  assert.equal(paymentAllocationLabel({saldo_cancelado:75,no_aplicado:0,comprometido:0}),'Saldo ajustado')
})

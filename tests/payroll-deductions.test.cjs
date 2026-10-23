const test=require('node:test'),assert=require('node:assert/strict'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('printed payslip keeps the complete frozen deduction reason and net amount',()=>{
 const Card=loadReportModule('../payroll/pages/PayslipCard.tsx').default
 const reason='Acuerdo de descuento '+ 'a'.repeat(180)
 const html=renderToStaticMarkup(React.createElement(Card,{payslip:{days_worked:'30',total_earnings:'1000.00',total_deductions:'125.50',net_pay:'874.50',employer_cost:'0',lines:[{id:'D',type:'DEDUCCION',concept:'OTRA_DEDUCCION',description:'Acuerdo de descuento',amount:'125.50',deduction_snapshot:{reason}}]}}))
 assert.ok(html.includes(reason));assert.match(html,/874\.50/);assert.match(html,/125\.50/)
})

const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {flush}=require('./helpers/configHarness.cjs')
test('print history keeps read-only rows visible without exposing their copy action',async()=>{
 const h=hookHarness(),nodes=[],scope={companyId:'C',branchId:'B',userId:'U'}
 const rows=[{id:'own',capabilities:{reprint:true}},{id:'other',capabilities:{reprint:false}},{id:'legacy'}].map(row=>({...row,source:{kind:'SALE_TICKET',id:row.id},state:'CREATED',document:'MAIN',createdAt:'2026-10-17T12:00:00Z'}))
 const {PrintHistory}=loadReportModule('../config/hardware/printing/PrintHistory.tsx',{
  react:h.hooks,
  './api':{printRequest:async()=>({items:rows,page:1,totalPages:1,totalItems:3,pageSize:10})},
  './usePrintJob':{usePrintJob:()=>({pending:false,error:'',blob:null})},
  '@/services/printRenderers':{renderPrintSource(){}},
 },nodes)
 h.render(()=>PrintHistory({scope}));await flush();nodes.length=0
 h.render(()=>PrintHistory({scope}))
 const items=nodes.filter(node=>node.type==='li')
 assert.equal(items.length,3)
 const actions=nodes.filter(node=>node.props.children==='Preparar copia')
 assert.equal(actions.length,1)
 actions[0].props.onClick();nodes.length=0
 h.render(()=>PrintHistory({scope}))
 assert.ok(nodes.some(node=>node.props.children==='Motivo de la copia'||Array.isArray(node.props.children)&&node.props.children.includes('Motivo de la copia')))
 h.unmount()
})

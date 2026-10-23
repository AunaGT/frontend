const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
test('base selection is a keyboard-operable action, not an editable system template',()=>{
  const nodes=[],choices=[]
  const {TemplateBases}=loadReportModule('../config/documentTemplates/TemplateBases.tsx',{},nodes)
  TemplateBases({bases:['CLASSIC','COMPACT','CORPORATE'],format:'A4',onChoose:id=>choices.push(id),disabled:false})
  const buttons=nodes.filter(n=>n.type==='button')
  assert.equal(buttons.length,3);buttons[1].props.onClick();assert.deepEqual(choices,['COMPACT'])
  assert.ok(buttons.every(n=>n.props.type==='button'))
})
test('the classic fiscal base is explicitly pending while the default ticket is 80 mm',()=>{
  const {TemplateBases}=loadReportModule('../config/documentTemplates/TemplateBases.tsx')
  const invoice=renderToStaticMarkup(React.createElement(TemplateBases,{bases:['CLASSIC'],format:'LETTER',purpose:'FEL_INVOICE',onChoose:()=>{}}))
  assert.match(invoice,/Clásico FEL/);assert.match(invoice,/Pendiente/)
  const ticket=renderToStaticMarkup(React.createElement(TemplateBases,{bases:['CLASSIC'],format:'RECEIPT_80',onChoose:()=>{}}))
  assert.match(ticket,/Ticket Auna/);assert.match(ticket,/80 mm/)
})
test('catalog opens on 80 mm and every create action preserves the chosen pending-FEL purpose',async()=>{
  const {hookHarness}=require('./helpers/reportHookHarness.cjs'),h=hookHarness(),nodes=[],paths=[]
  const scope={companyId:'A',branchId:'B',userId:'U',sessionId:'S'},manifest={bases:['CLASSIC'],presets:{},fiscalPresets:{},fiscalEnabled:false}
  const api={listTemplates:async()=>({rows:[],total:0}),templateSchema:async()=>manifest}
  const Page=loadReportModule('../config/pages/DocumentTemplatesPage.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>path=>paths.push(path)},'@/components/layout/PageNavigation':{usePageTrail:()=>{}},'../documentTemplates/useTemplateScope':{useTemplateScope:()=>({scope,canRead:true,canManage:true,canPublish:true,companyName:'Empresa',key:'A'})},[require('node:path').resolve(__dirname,'../src/modules/config/documentTemplates/api.ts')]:api},nodes).default
  const root=Page(),render=()=>{nodes.length=0;return h.render(()=>root.type(root.props))}
  render();await new Promise(r=>setImmediate(r));render()
  let base=nodes.find(n=>n.type.name==='TemplateBases');assert.equal(base.props.format,'RECEIPT_80')
  nodes.find(n=>n.props.children==='Factura FEL · Pendiente').props.onClick();render()
  base=nodes.find(n=>n.type.name==='TemplateBases');assert.equal(base.props.format,'LETTER');assert.equal(base.props.purpose,'FEL_INVOICE')
  nodes.find(n=>n.props.children==='Crear diseño').props.onClick()
  nodes.find(n=>n.props.children==='Crear mi primer diseño').props.onClick()
  assert.equal(paths.length,2);for(const route of paths){assert.match(route,/formato=LETTER/);assert.match(route,/tipo=FEL_INVOICE/)}
  h.unmount()
})

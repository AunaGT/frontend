const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const bases=require('../../deposito-backend/src/modules/config/customerPages/bases')
const context={documentType:'QUOTE',reference:'C-001',status:'SENT',companyName:'Empresa',customer:'Ana',subtotal:'9007199254740993.25',discount:'0',total:'9007199254740993.25',currency:'GTQ',locale:'es-GT',timezone:'America/Guatemala',canRespond:true,lines:[{name:'Servicio exacto',qty:'0.125',unitLabel:'hora',unitPrice:'18.00',total:'2.25'}]}
test('a mobile preview uses its selected width rather than the desktop browser viewport',()=>{
 const {PortalRenderer,breakpointForWidth}=loadReportModule('../../components/customer-pages/PortalRenderer.tsx'),design=bases.resolveBase('QUOTE');design.nodes[0].styles={desktop:{padding:40},tablet:{padding:24},mobile:{padding:12}}
 const html=renderToStaticMarkup(React.createElement(PortalRenderer,{portal:{versionId:'v1',rendererVersion:1,design,customArtifacts:{},customCodeEnabled:false},context,actions:{},mode:'preview',breakpoint:'mobile'}))
 assert.match(html,/data-breakpoint="mobile"/);assert.match(html,/padding:12px/);assert.match(html,/grid-template-columns:repeat\(1,minmax\(0,1fr\)\)/);assert.doesNotMatch(html,/padding:40px/)
 assert.equal(breakpointForWidth(375),'mobile');assert.equal(breakpointForWidth(768),'tablet');assert.equal(breakpointForWidth(1024),'desktop')
})
function render(design,ctx=context,actions={}){const {PortalRenderer}=loadReportModule('../../components/customer-pages/PortalRenderer.tsx');return renderToStaticMarkup(React.createElement(PortalRenderer,{portal:{versionId:'v1',rendererVersion:1,design,customArtifacts:{},customCodeEnabled:false},context:ctx,actions,mode:'preview'}))}
test('commercial facts ignore design values and retain decimal strings without arithmetic rounding',()=>{
 const d=bases.resolveBase('QUOTE');d.nodes.find(n=>n.type==='QuoteResponse').props.total='0.01'
 const html=render(d);assert.match(html,/0\.125/);assert.match(html,/9,007,199,254,740,993\.25/);assert.match(html,/Servicio exacto/);assert.match(html,/Aceptar cotización/);assert.doesNotMatch(html,/0\.01/)
})
test('unknown blocks fall back to visible official facts and terminal quotes never offer response',()=>{
 const d=bases.resolveBase('QUOTE');d.nodes=[{...d.nodes[0],type:'Mystery'}]
 const html=render(d,{...context,status:'ACCEPTED',canRespond:false,validUntil:'2026-12-31'});assert.match(html,/C-001/);assert.match(html,/9,007,199,254,740,993\.25/);assert.doesNotMatch(html,/Aceptar cotización/);assert.match(html,/31 de diciembre de 2026/)
})
test('large orders paginate real lines and display exact partial fulfillment',()=>{
 const ctx={...context,documentType:'ORDER',status:'PARTIALLY_FULFILLED',lines:Array.from({length:120},(_,i)=>({name:'Partida '+i,qty:'0.125',fulfilled:'0.025',unitLabel:'kg',unitPrice:'10.00',total:'1.25'}))}
 const html=render(bases.resolveBase('ORDER'),ctx);assert.match(html,/0\.025/);assert.match(html,/Página 1 de 12/);assert.match(html,/Partida 9</);assert.doesNotMatch(html,/Partida 10</)
})
test('catalog cards show partial delivery in its historical base unit instead of pretending it is a whole presentation',()=>{const c={...context,documentType:'ORDER',status:'PARTIALLY_FULFILLED',lines:[{name:'Caja de harina',qty:'2',fulfilled:'0.025',unitLabel:'caja',fulfilledUnitLabel:'kg',unitPrice:'50.00',total:'100.00'}]},html=render(bases.resolveBase('ORDER','CATALOG'),c);assert.match(html,/Entregado/);assert.match(html,/0\.025.*kg/);assert.doesNotMatch(html,/0\.025.*caja/)});
test('HTML strings are escaped and custom code remains a placeholder without an iframe in preview',()=>{
 const d=bases.resolveBase('QUOTE');d.customBlocks.demo={html:'<script>alert(1)</script>',css:'',js:'alert(1)',fallbackText:'Decoración'};d.nodes.push({id:'custom',type:'CustomVisual',props:{blockId:'demo'},styles:{desktop:{},tablet:{},mobile:{}},children:[],visibility:{}})
 d.nodes.push({id:'text',type:'Text',props:{text:'<img src=x onerror=alert(1)>'},styles:{desktop:{},tablet:{},mobile:{}},children:[],visibility:{}})
 const html=render(d);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script|<iframe|onerror="/);assert.match(html,/Decoración/)
})
test('imported structured rich text renders document nodes without accepting raw HTML',()=>{const d=bases.resolveBase('QUOTE');d.nodes.push({id:'rich',type:'Text',props:{document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Una propuesta profesional',marks:[{type:'bold'}]}]}]}},styles:{desktop:{},tablet:{},mobile:{}},children:[],visibility:{}});assert.match(render(d),/<strong><span>Una propuesta profesional<\/span><\/strong>|<strong>Una propuesta profesional<\/strong>/)});

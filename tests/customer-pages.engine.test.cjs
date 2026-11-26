const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const engine=()=>loadReportModule('../config/customerPages/engine/model.ts')
const node=(id,type='Text',children=[])=>({id,type,props:{text:id},styles:{desktop:{},tablet:{},mobile:{}},visibility:{},children})
const fixture=()=>({schemaVersion:1,documentType:'QUOTE',theme:{},nodes:[node('section','Section',[node('a'),node('b')])],resources:{},savedSections:[],customBlocks:{}})
test('engine preserves nested composition and independent styles through its own data format',()=>{
 const {toPuckData,fromPuckData}=engine(),design=fixture()
 design.nodes[0].styles.mobile={padding:16}
 assert.deepEqual(fromPuckData(toPuckData(design),design),design)
})
test('moving a block in engine data changes only its position and never introduces document data',()=>{
 const {toPuckData,fromPuckData}=engine(),design=fixture(),data=toPuckData(design)
 data.content[0].props.content.reverse()
 const result=fromPuckData(data,design)
 assert.deepEqual(result.nodes[0].children.map(n=>n.id),['b','a'])
 assert.equal(result.documentType,'QUOTE');assert.equal(result.nodes[0].children[0].props.text,'b')
})
test('custom blocks remain opaque references, never evaluated code or executable editor content',()=>{
 const {toPuckData,fromPuckData}=engine(),design=fixture()
 design.nodes=[{...node('code','CustomVisual'),props:{blockId:'visual'}}]
 design.customBlocks={visual:{html:'<script>throw Error("must not run")</script>',css:'',js:'throw Error("must not run")',fallbackText:'Visual'}}
 const data=toPuckData(design)
 assert.equal(JSON.stringify(data).includes('must not run'),false)
 assert.deepEqual(fromPuckData(data,design).customBlocks,design.customBlocks)
})
test('the installed engine renders nested Auna column slots with real trusted components and inert code',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{Render}=require('@puckeditor/core'),{makePortalConfig}=loadReportModule('../config/customerPages/engine/PuckAdapter.tsx'),{PortalBlock}=loadReportModule('../../components/customer-pages/PortalBlock.tsx'),{resolveBase}=require('../../deposito-backend/src/modules/config/customerPages/bases'),{definitions}=require('../../deposito-backend/src/modules/config/customerPages/schema'),{getPreviewScenario}=loadReportModule('../config/customerPages/previewScenarios.ts'),d=resolveBase('QUOTE'),context=getPreviewScenario('QUOTE','SENT'),render=(node,children)=>React.createElement(PortalBlock,{node,design:d,context,preview:true},children),config=makePortalConfig({registry:Object.entries(definitions).map(([type,def])=>({type,...def})),renderOfficial:render,renderCustomPlaceholder:render})
 const html=renderToStaticMarkup(React.createElement(Render,{config,data:engine().toPuckData(d)}));assert.match(html,/grid-template-columns:repeat\(var\(--portal-columns/);assert.match(html,/Consultoría de diseño/);assert.match(html,/Datos de ejemplo/);assert.doesNotMatch(html,/<iframe|<script/)
})
test('drawer insertion creates valid editable defaults and pending image resources',()=>{
 const {makePortalConfig}=loadReportModule('../config/customerPages/engine/PuckAdapter.tsx'),{toPuckData,fromPuckData}=engine(),{definitions}=require('../../deposito-backend/src/modules/config/customerPages/schema'),{validateDesign}=require('../../deposito-backend/src/modules/config/customerPages/validate'),design=require('../../deposito-backend/src/modules/config/customerPages/bases').resolveBase('QUOTE')
 const config=makePortalConfig({registry:Object.entries(definitions).map(([type,def])=>({type,...def})),renderOfficial:()=>null,renderCustomPlaceholder:()=>null})
 const data=toPuckData(design)
 for(const type of ['Text','Image'])data.content.push({type,props:{...structuredClone(config.components[type].defaultProps),id:'inserted-'+type}})
 const result=fromPuckData(data,design)
 assert.equal(result.nodes.at(-2).props.text,'Escribe tu mensaje aquí.')
 assert.ok(result.resources[result.nodes.at(-1).props.resource])
 assert.doesNotThrow(()=>validateDesign(result,{mode:'compose'}))
})
test('the complete editor mounts its drawer and viewport in the real engine context',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{resolveBase}=require('../../deposito-backend/src/modules/config/customerPages/bases'),{definitions}=require('../../deposito-backend/src/modules/config/customerPages/schema'),design=resolveBase('QUOTE')
 const {PortalEditor}=loadReportModule('../config/customerPages/PortalEditor.tsx',{
  './PortalAssetLibrary':{usePortalAssetUrls:()=>({}),PortalAssetLibrary:()=>null},
  '../documentTemplates/useTemplateConfirmation':{useTemplateConfirmation:()=>({confirm:async()=>false,dialog:null})},
  './api':{},
 })
 const html=renderToStaticMarkup(React.createElement(PortalEditor,{design,record:{id:'draft'},scope:{},schema:{blocks:definitions},onChange(){},readOnly:false,canCode:false,saveNow:async()=>{},onRecord(){},onTestCode(){}}))
 assert.match(html,/drawer-item:Text/)
 assert.match(html,/Código de página/)
 assert.match(html,/Mostrar u ocultar propiedades/)
 assert.match(html,/Tamaño de pantalla/)
})
test('component permissions never override globally denied readonly operations',()=>{
 const {makePortalConfig}=loadReportModule('../config/customerPages/engine/PuckAdapter.tsx'),{definitions}=require('../../deposito-backend/src/modules/config/customerPages/schema')
 const config=makePortalConfig({registry:Object.entries(definitions).map(([type,def])=>({type,...def})),renderOfficial:()=>null,renderCustomPlaceholder:()=>null})
 for(const component of Object.values(config.components)) {
  const effective={edit:false,drag:false,insert:false,delete:false,duplicate:false,...component.permissions}
  assert.equal(Object.values(effective).some(Boolean),false)
 }
})

const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{resolveBase}=require('../../deposito-backend/src/modules/config/customerPages/bases')
test('a copied custom section remaps parsed data-asset attributes without rewriting visible text or unrelated JavaScript',()=>{
 const {insertSavedSection}=loadReportModule('../config/customerPages/sectionCopy.ts'),design=resolveBase('QUOTE');design.resources.logo={assetId:'wrong-destination',alt:'Otro logo'}
 const section={document_type:'QUOTE',design:{resources:{logo:{assetId:'correct-source',alt:'Logo'}},customBlocks:{visual:{html:'<p>logo</p><img DATA-ASSET="l&#111;go">',css:'',js:'const label="logo";',fallbackText:'Logo'}},nodes:[{id:'visual',type:'CustomVisual',props:{blockId:'visual'},styles:{desktop:{},tablet:{},mobile:{}},visibility:{},children:[]}]}}
 const out=insertSavedSection(design,section),key=out.nodes.at(-1).props.blockId,block=out.customBlocks[key],resourceKey=Object.keys(out.resources).find(k=>out.resources[k].assetId==='correct-source');assert.ok(block.html.includes('data-asset="'+resourceKey+'"'));assert.match(block.html,/<p>logo<\/p>/);assert.equal(block.js,'const label="logo";')
})
test('reusable sections copy images with bounded fresh logical keys rather than concatenating unbounded names',()=>{
 const {insertSavedSection}=loadReportModule('../config/customerPages/sectionCopy.ts'),key='photo-'+'x'.repeat(70),design=resolveBase('QUOTE'),section={document_type:'QUOTE',design:{resources:{[key]:{assetId:'',alt:'Foto'}},customBlocks:{},nodes:[{id:'photo',type:'Image',props:{resource:key},styles:{desktop:{},tablet:{},mobile:{}},visibility:{},children:[]}]}}
 const out=insertSavedSection(design,section),node=out.nodes.at(-1);assert.notEqual(node.id,'photo');assert.ok(node.props.resource.length<=80);assert.equal(out.resources[node.props.resource].alt,'Foto');assert.equal(design.resources[key],undefined)
})

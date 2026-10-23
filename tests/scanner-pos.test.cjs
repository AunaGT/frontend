const test=require('node:test'),assert=require('node:assert/strict'),{renderPos}=require('./helpers/posPageHarness.cjs')
test('contextual POS scan adds once through existing cart logic and never submits a sale',async()=>{
 const additions=[],view=renderPos({state:{saleStep:'products'},items:[],scanProduct:async()=>({product:{id:'p',name:'Servicio',kind:'SERVICE',price:'10',stock:0},presentationId:null,unitRevision:1}),cartOverrides:{addToCart:(p,selection)=>additions.push({p,selection})}})
 const field=view.nodes.find(n=>n.type.name==='ScannerField');assert.ok(field);assert.equal(field.props.enabled,true)
 await field.props.onScan('001',new AbortController().signal);assert.equal(additions.length,1);assert.equal(additions[0].p.id,'p');assert.equal(view.writes.length,0)
})
test('payment step does not accept a contextual scan',async()=>{
 let lookups=0;const view=renderPos({state:{saleStep:'payment'},scanProduct:async()=>{lookups++;throw Error('unexpected')}})
 const field=view.nodes.find(n=>n.type.name==='ScannerField');if(field){assert.equal(field.props.enabled,false);await field.props.onScan('001',new AbortController().signal)}
 assert.equal(lookups,0);assert.equal(view.writes.length,0)
})

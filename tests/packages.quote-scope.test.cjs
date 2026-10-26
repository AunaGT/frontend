const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('late package preview cannot replace current branch or choice, unchanged stored agreement is not repriced',async()=>{
 const h=hookHarness(),pending=[]
 const {useQuotePackagePreview}=loadReportModule('../quotes/packageSelection.ts',{react:h.hooks,'@/modules/inventory/packages/api':{previewPackages:async(scope,selections,signal)=>new Promise(resolve=>pending.push({scope,selections,signal,resolve}))}})
 const original={groupId:'g',packageId:'p',version:1,variantId:'v',choices:[]},stored=[{groupId:'g',selection:original,name:'Precio acordado',state:'COMPLETE',amount:'19.99',netAmount:'19.99',components:[],issues:[]}]
 const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'}
 const render=(s,v,groups=[])=>h.render(()=>useQuotePackagePreview(s,v,groups))
 try{
  const saved=render(scope,[original],stored);assert.equal(saved.groups[0].amount,'19.99');assert.equal(pending.length,0)
  render(scope,[{...original,groupId:'new'}]);await new Promise(r=>setTimeout(r,260));assert.equal(pending.length,1)
  const other={...scope,branchId:'other'};render(other,[{...original,groupId:'other'}]);await new Promise(r=>setTimeout(r,260));assert.equal(pending.length,2)
  pending[0].resolve({packageGroups:[{name:'STALE'}],subtotal:'1.00',items:[],issues:[]});await new Promise(r=>setImmediate(r))
  assert.ok(!render(other,[{...original,groupId:'other'}]).groups.some(g=>g.name==='STALE'));assert.equal(pending[0].signal.aborted,true)
  pending[1].resolve({packageGroups:[{name:'Current'}],subtotal:'5.00',items:[],issues:[]});await new Promise(r=>setImmediate(r))
  assert.equal(render(other,[{...original,groupId:'other'}]).groups[0].name,'Current')
 }finally{h.unmount()}
})
test('a preview from an earlier document revision is ignored even when selection stays identical',async()=>{
 const h=hookHarness(),pending=[]
 const {useQuotePackagePreview}=loadReportModule('../quotes/packageSelection.ts',{react:h.hooks,'@/modules/inventory/packages/api':{previewPackages:async(...args)=>new Promise(resolve=>pending.push({args,resolve}))}})
 const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'},selection=[{groupId:'g',packageId:'p',version:1,variantId:'v',choices:[]}]
 const render=revision=>h.render(()=>useQuotePackagePreview(scope,selection,[],{quoteId:'q',expectedRevision:revision}))
 try{
  render('one');await new Promise(r=>setTimeout(r,250));render('two');await new Promise(r=>setTimeout(r,250))
  assert.equal(pending.length,2);assert.equal(pending[0].args[2].aborted,true)
  pending[0].resolve({packageGroups:[{name:'STALE'}]});await new Promise(r=>setImmediate(r))
  assert.deepEqual(render('two').groups,[])
 }finally{h.unmount()}
})

const test=require('node:test'),assert=require('node:assert/strict')
const {renderPos}=require('./helpers/posPageHarness.cjs')
const selection={groupId:'g',packageId:'p',version:1,variantId:'v',choices:[]}
const group={schemaVersion:1,groupId:'g',name:'Fiesta',variantName:'80 shots',currency:'GTQ',state:'COMPLETE',estimatedAmount:'150.00',amount:'150.00',netAmount:'150.00',issues:[],components:[]}
const packages=(preview,saved=[])=>({
 '@/modules/inventory/packages/selection':{packageSelectionsPayload:v=>v.map(s=>({...s})),useCommercialPackagePreview:()=>preview},
 '@/modules/inventory/packages/CommercialPackagesEditor':{CommercialPackagesEditor:function CommercialPackagesEditor(){return null}},
 '@/services/saleDraftStorage':{saveNewSaleDraft:(user,draft)=>saved.push(draft),loadNewSaleDraft:()=>null,consumeNewSaleDraft:()=>false,hasNewSaleDraft:()=>false},
})
const ready={groups:[group],pending:false,error:'',incomplete:false}
const submit=view=>view.nodes.find(n=>n.props.onClick?.name==='handleSubmit')
test('POS charges a package-only cart once and sends selections instead of lines',async()=>{
 const view=renderPos({items:[],state:{packages:[selection],amountReceived:'150'},moduleOverrides:packages(ready)})
 assert.match(view.html,/Fiesta · 80 shots/);assert.equal(submit(view).props.disabled,false)
 await submit(view).props.onClick()
 assert.deepEqual(view.writes[0].items,[]);assert.deepEqual(view.writes[0].packages,[selection])
})
test('the package price joins the total used for the cash check',()=>{
 const short=renderPos({state:{packages:[selection],amountReceived:'100'},moduleOverrides:packages(ready)})
 assert.equal(submit(short).props.disabled,true,'Q10 of items + Q150 package needs Q160')
 const enough=renderPos({state:{packages:[selection],amountReceived:'160'},moduleOverrides:packages(ready)})
 assert.equal(submit(enough).props.disabled,false);assert.match(enough.html,/160/)
})
test('an incomplete or unpriced package blocks payment',()=>{
 for(const preview of [{groups:[{...group,state:'INCOMPLETE',amount:null}],pending:false,error:'',incomplete:true},{groups:[],pending:true,error:'',incomplete:true}]){
  const view=renderPos({items:[],state:{packages:[selection],saleStep:'products'},moduleOverrides:packages(preview)})
  assert.equal(view.nodes.find(n=>n.props['aria-label']==='Ir al pago').props.disabled,true)
 }
})
test('saving for later keeps the package selection and ordinary carts stay unchanged',async()=>{
 const saved=[],view=renderPos({items:[],state:{packages:[selection],saleStep:'products'},moduleOverrides:packages(ready,saved)})
 view.nodes.find(n=>n.props.className==='pos-save-button').props.onClick()
 assert.deepEqual(saved[0].packages,[selection]);assert.deepEqual(view.stateUpdates.packages,[])
 const plain=renderPos({moduleOverrides:packages({groups:[],pending:false,error:'',incomplete:false})})
 await submit(plain).props.onClick();assert.equal('packages' in plain.writes[0],false)
})

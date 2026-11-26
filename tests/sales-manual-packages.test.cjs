const test=require('node:test'),assert=require('node:assert/strict')
const {manualPage}=require('./helpers/manualSaleHarness.cjs')
const selection={groupId:'g',packageId:'p',version:1,variantId:'v',choices:[{choiceId:'c',items:[{optionId:'o',quantity:'2'}]}]}
const group={schemaVersion:1,groupId:'g',name:'Fiesta',variantName:'80 shots',currency:'GTQ',state:'COMPLETE',estimatedAmount:'150.00',amount:'150.00',netAmount:'150.00',selection,issues:[],components:[{key:'g:1',productId:'P',itemName:'Shot',itemKind:'STANDARD',quantity:'2',unitLabel:'unidad',quantityDecimals:0,unitPrice:'75',lineTotal:'150.00',netLineTotal:'150.00'}]}
const editor=nodes=>nodes.find(n=>n.type?.name==='CommercialPackagesEditor')
const save=nodes=>nodes.find(n=>n.props?.['aria-label']==='Guardar borrador')
test('a package-only direct sale can be saved and sends the selection, not component lines',async()=>{
 const page=manualPage({preview:{total:'150.00',items:[],packageGroups:[group]}})
 try{
  let {nodes}=page.render();assert.equal(editor(nodes).props.scope.purpose,'sale');assert.equal(save(nodes).props.disabled,true)
  editor(nodes).props.onChange([selection]);({nodes}=page.render());await Promise.resolve();({nodes}=page.render())
  assert.equal(save(nodes).props.disabled,false);await save(nodes).props.onClick()
  assert.deepEqual(page.writes[0].input.items,[]);assert.deepEqual(page.writes[0].input.packages,[selection])
 }finally{page.cleanup()}
})
test('reopening a native package draft keeps components out of the free items',async()=>{
 const draft={id:'D',reference:'V-9',version:2,status:'DRAFT',originQuote:null,customerId:null,customerName:'',customerNit:'',total:'150.00',dueDate:null,packageGroups:[group],
  items:[{id:1,packageComponentKey:'g:1',productId:'P',name:'Shot',kind:'STANDARD',qty:'2',unitPrice:'75',lineTotal:'150.00',unitLabel:'unidad',quantityDecimals:0,unitSnapshot:null,unitMetadataVersion:1,baseQty:null}]}
 const page=manualPage({draft,preview:{total:'0.00',items:[],packageGroups:[]}})
 try{
  let nodes;for(let i=0;i<4;i++)({nodes}=page.render());await new Promise(r=>setTimeout(r,0));({nodes}=page.render())
  assert.deepEqual(editor(nodes).props.value,[selection]);assert.equal(save(nodes).props.disabled,true,'unchanged draft')
  assert.ok(!nodes.some(n=>n.props?.['aria-label']==='Cantidad de Shot'),'component is not an editable free line')
  editor(nodes).props.onChange([]);({nodes}=page.render());({nodes}=page.render())
  assert.equal(save(nodes).props.disabled,true,'empty sale cannot be saved')
 }finally{page.cleanup()}
})

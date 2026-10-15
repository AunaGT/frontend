const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const {createLabelTemplate}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts'),{labelEditorReducer}=loadReportModule('../inventory/barcodeLabels/labelEditorState.ts')
const initial=()=>({design:createLabelTemplate(),past:[],future:[],selectedId:'bars',zoom:1,error:''})
test('mandatory layers stay, one move is undoable, and locked layers cannot move',()=>{
  const start=initial();assert.equal(labelEditorReducer(start,{type:'DELETE',id:'bars'}).design.elements.length,start.design.elements.length)
  const moved=labelEditorReducer(start,{type:'PATCH',id:'bars',patch:{x:.04,width:.93}})
  assert.equal(moved.past.length,1);assert.equal(moved.design.elements.find(e=>e.id==='bars').x,.04)
  assert.deepEqual(labelEditorReducer(moved,{type:'UNDO'}).design,start.design)
  const locked=labelEditorReducer(start,{type:'PATCH',id:'bars',patch:{locked:true}})
  assert.equal(labelEditorReducer(locked,{type:'PATCH',id:'bars',patch:{x:.06}}).design.elements.find(e=>e.id==='bars').x,.03)
})
test('a visible decoration cannot cover barcode white zone and failed edit keeps draft',()=>{
  const start=initial(),next=labelEditorReducer(start,{type:'ADD',element:{id:'decoration',kind:'shape',shape:'rect',x:0,y:0,width:1,height:1,visible:true,locked:false,color:'#ffffff',borderColor:'#000000',borderWidth:0}})
  assert.deepEqual(next.design,start.design);assert.ok(next.error)
})
test('template replacement and undo clear selection when its layer no longer exists',()=>{
  let state={...initial(),selectedId:'name'};state=labelEditorReducer(state,{type:'DESIGN',design:createLabelTemplate('essential')});assert.equal(state.selectedId,null)
  state=labelEditorReducer(state,{type:'UNDO'});state=labelEditorReducer(state,{type:'SELECT',id:'name'});state=labelEditorReducer(state,{type:'REDO'});assert.equal(state.selectedId,null)
})

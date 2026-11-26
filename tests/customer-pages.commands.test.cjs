const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{resolveBase}=require('../../deposito-backend/src/modules/config/customerPages/bases')
const load=()=>loadReportModule('../config/customerPages/editorState.ts')
test('a quote keeps validity when deleting it or its parent, while an order may omit its optional validity',()=>{
 const e=load(),state=e.createEditorState(resolveBase('QUOTE')),find=nodes=>nodes.flatMap(n=>[n,...find(n.children)]),validity=find(state.design.nodes).find(n=>n.type==='Validity');
 assert.throws(()=>e.applyPortalCommand(state,{type:'remove',id:validity.id}));
 const parent=find(state.design.nodes).find(n=>n.children.some(c=>c.id===validity.id));assert.throws(()=>e.applyPortalCommand(state,{type:'remove',id:parent.id}));
 const order=e.createEditorState(resolveBase('ORDER')),optional=find(order.design.nodes).find(n=>n.type==='Validity');assert.doesNotThrow(()=>e.applyPortalCommand(order,{type:'remove',id:optional.id}));
})
test('removing visual blocks retires unreachable source/resources but retains shared references and undo',()=>{
 const e=load();let state=e.createEditorState(resolveBase('QUOTE'))
 state.design.resources.photo={assetId:'',alt:'Pendiente'};state.design.customBlocks.visual={html:'<img data-asset="photo">',css:'',js:'',fallbackText:'Hola'}
 state=e.applyPortalCommand(state,{type:'insert',blockType:'CustomVisual',props:{blockId:'visual'}});const customId=state.selection
 state=e.applyPortalCommand(state,{type:'insert',blockType:'Image',props:{resource:'photo'}});const imageId=state.selection
 state=e.applyPortalCommand(state,{type:'remove',id:imageId});assert.ok(state.design.resources.photo)
 state=e.applyPortalCommand(state,{type:'remove',id:customId});assert.deepEqual(state.design.resources,{});assert.deepEqual(state.design.customBlocks,{})
 const previous=e.undoPortalCommand(state);assert.ok(previous.design.resources.photo);assert.ok(previous.design.customBlocks.visual)
})
test('undoing a newly inserted visual block also retires its prepared source and pending image',()=>{
 const e=load(),before=e.createEditorState(resolveBase('QUOTE'));
 before.design.resources.logo={assetId:'',alt:'Logo'};before.design.customBlocks.visual={html:'<img data-asset="logo">',css:'',js:'',fallbackText:'Logo'};
 const inserted=e.applyPortalCommand(before,{type:'insert',blockType:'CustomVisual',props:{blockId:'visual'}}),undone=e.undoPortalCommand(inserted);
 assert.deepEqual(undone.design.customBlocks,{});assert.deepEqual(undone.design.resources,{});
 const restored=e.redoPortalCommand(undone);assert.ok(restored.design.customBlocks.visual);assert.ok(restored.design.resources.logo);
})
test('engine replacement cannot remove required facts or exceed client composition limits',()=>{
 const e=load(),state=e.createEditorState(resolveBase('QUOTE')),bad=structuredClone(state.design);bad.nodes=[]
 assert.throws(()=>e.applyPortalCommand(state,{type:'replace',design:bad}))
 const oversized=structuredClone(state.design);oversized.nodes.push(...Array.from({length:201},(_,i)=>({id:'x'+i,type:'Text',props:{text:'x'},styles:{desktop:{},tablet:{},mobile:{}},visibility:{},children:[]})))
 assert.throws(()=>e.applyPortalCommand(state,{type:'replace',design:oversized}))
})
test('commands protect official facts, renew copied IDs, and bound undo to the latest 100 edits',()=>{
 const e=load();let state=e.createEditorState(resolveBase('QUOTE'))
 const identity=state.design.nodes[0];assert.throws(()=>e.applyPortalCommand(state,{type:'remove',id:identity.id}))
 assert.throws(()=>e.applyPortalCommand(state,{type:'duplicate',id:identity.id}))
 state=e.applyPortalCommand(state,{type:'insert',blockType:'Text'});const id=state.selection
 state=e.applyPortalCommand(state,{type:'setProps',id,props:{text:'Original'}});state=e.applyPortalCommand(state,{type:'duplicate',id});assert.notEqual(state.selection,id)
 for(let i=0;i<101;i++)state=e.applyPortalCommand(state,{type:'setProps',id,props:{text:'Edit '+i}})
 assert.equal(state.past.length,100);const undone=e.undoPortalCommand(state);assert.equal(e.findNode(undone.design,id).props.text,'Edit 99')
 assert.equal(e.applyPortalCommand(undone,{type:'setProps',id,props:{text:'Rama'}}).future.length,0)
})
test('responsive styles inherit until overridden and reset never changes desktop',()=>{
 const e=load();let state=e.createEditorState(resolveBase('QUOTE')),id=state.design.nodes[0].id
 state=e.applyPortalCommand(state,{type:'setStyle',id,breakpoint:'desktop',key:'padding',value:32})
 state=e.applyPortalCommand(state,{type:'setStyle',id,breakpoint:'mobile',key:'padding',value:12})
 assert.equal(e.findNode(state.design,id).styles.desktop.padding,32)
 state=e.applyPortalCommand(state,{type:'resetStyle',id,breakpoint:'mobile',key:'padding'});assert.equal(e.findNode(state.design,id).styles.mobile.padding,undefined)
})
test('moving into a descendant is rejected and deleting editable text never triggers canvas delete',()=>{
 const e=load();let state=e.createEditorState(resolveBase('QUOTE'));const section=state.design.nodes.find(n=>n.children.length),child=section.children[0]
 assert.throws(()=>e.applyPortalCommand(state,{type:'move',id:section.id,parentId:child.id,index:0}))
 assert.equal(e.isEditingText({tagName:'TEXTAREA'}),true);assert.equal(e.isEditingText({isContentEditable:true}),true);assert.equal(e.isEditingText({tagName:'BUTTON'}),false)
})

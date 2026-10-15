const test=require('node:test'),assert=require('node:assert/strict'),{hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
function mount() {
 const h=hookHarness(),requests=[];let resolver,fail,props={context:{companyId:'a',userId:'u'},id:101,canManage:true,role:{id:101,name:'Bodega',revision:0,protected:false,permissions:[]}}
 let api={};try{api=loadReportModule('../users/useRoleDraft.ts',{react:h.hooks,'@/services/userService':{updateRole:async(id,body)=>{requests.push({method:'PUT',id,body});if(fail)throw fail;return resolver?new Promise(r=>resolver(r)):{...props.role,revision:1,permissions:body.permissions.map(code=>({code}))}},createRole:()=>{throw Error('No implicit copies')}}})}catch(e){if(!e.message.includes('ENOENT'))throw e}
 const render=()=>{assert.equal(typeof api.useRoleDraft,'function');return h.render(()=>api.useRoleDraft(props))}
 return {render,requests,setRole:role=>props={...props,role},setContext:context=>props={...props,context},setManage:canManage=>props={...props,canManage},pending:fn=>resolver=fn,error:e=>fail=e,props:()=>props}
}
test('draft keeps pending switches on refetch, saves same ID with initial revision',async()=>{
 const m=mount();m.render();m.render().setSelected(['products.view']);m.setRole({...m.props().role});let d=m.render();assert.deepEqual(d.selected,['products.view']);assert.equal(m.requests.length,0)
 await d.save();assert.equal(m.requests[0].method,'PUT');assert.equal(m.requests[0].id,101);assert.equal(m.requests[0].body.expectedRevision,0);assert.equal(m.render().dirty,false)
})
test('failed/stale save retains draft and requires deliberate reset',async()=>{
 const m=mount();m.render();m.render().setName('Bodega editada');m.error(Object.assign(Error('Conflicto'),{status:409}));await m.render().save()
 assert.equal(m.render().name,'Bodega editada');assert.equal(m.render().conflict,true);await m.render().save();assert.equal(m.requests.length,1)
 m.setRole({...m.props().role,name:'Otro operador',revision:1});m.render();m.render().reset();assert.equal(m.render().name,'Otro operador');assert.equal(m.render().conflict,false)
})
test('double click sends once and late response after context change is ignored',async()=>{
 const m=mount();let resolve;m.pending(r=>resolve=r);m.render();m.render().setSelected(['products.view']);const d=m.render(),p=d.save();await d.save();assert.equal(m.requests.length,1)
 m.setContext({companyId:'b',userId:'u'});m.setRole(undefined);m.render();resolve({id:101,name:'Bodega',revision:1,permissions:[]});assert.equal(await p,undefined);assert.equal(m.render().name,'')
})
test('an old callback cannot edit the draft of a different company',()=>{
 const m=mount();m.render();const old=m.render();m.setContext({companyId:'b',userId:'u'});m.setRole(undefined);m.render();old.setName('Company A draft');assert.equal(m.render().name,'')
})
test('delayed reset cannot discard newer keystrokes or a draft after context round trip',()=>{
 const m=mount();m.render();m.render().setName('A pending');const resetA=m.render().reset
 m.render().setName('Newer A draft');m.render();resetA();assert.equal(m.render().name,'Newer A draft');assert.equal(m.render().dirty,true)
 const oldReset=m.render().reset;m.setContext({companyId:'b',userId:'u'});m.setRole({...m.props().role,id:202,name:'B'});m.render()
 m.setContext({companyId:'a',userId:'u'});m.setRole({...m.props().role,id:101,name:'A'});m.render();m.render().setName('Newest A');m.render();oldReset();assert.equal(m.render().name,'Newest A');assert.equal(m.render().dirty,true)
})
test('restoring a conflict blocks keystrokes while loading and hydrates the fetched revision',async()=>{
 const m=mount();m.render();m.render().setName('Pending');let finish
 assert.equal(typeof m.render().restore,'function')
 const pending=m.render().restore(()=>new Promise(r=>finish=r));m.render().setName('Late typing');assert.equal(m.render().name,'Pending');assert.equal(m.render().busy,true)
 finish({...m.props().role,name:'Saved by other user',revision:5});await pending;assert.equal(m.render().name,'Saved by other user');assert.equal(m.render().busy,false);assert.equal(m.render().dirty,false)
})
module.exports={mount}

const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'},flush=()=>new Promise(setImmediate)
function editor(id){
 const h=hookHarness(),nodes=[],guards=[],uploads=[],saves=[],row={id:'p',version:3,activeVersion:2,archivedAt:null,branchIds:['b'],definition:{schemaVersion:1,name:'Fiesta',description:'',currency:'GTQ',imageUrl:'https://old.invalid/image.png',variants:[{id:'v1',name:'Pequeño',price:'100',components:[],choices:[]},{id:'v2',name:'Grande',price:'200',components:[],choices:[]}]}}
 const {PackageEditor}=loadReportModule('../inventory/packages/PackageEditorPage.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ'})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:dirty=>{guards.push(dirty);return{dialog:null,request:fn=>fn(),proceed:fn=>fn()}}},'./api':{fetchPackage:async()=>structuredClone(row),packageQueryKey:()=>[],packageError:e=>e.message,savePackage:async(...args)=>{saves.push(args);return{id:'p'}},uploadPackageImage:(_scope,file,signal)=>new Promise((resolve,reject)=>uploads.push({file,signal,resolve,reject}))}},nodes)
 const context={scope,key:'a/b',canEdit:true,canRead:true,branches:[{id:'b',name:'Principal'},{id:'c',name:'Otra'}]}
 const render=()=>{nodes.length=0;h.render(()=>PackageEditor({context,id}));return nodes}
 return{h,nodes,render,guards,uploads,saves,row,context}
}
test('editing drafts does not enable publication and publishers can activate without editing',async()=>{
 const f=editor('p');f.context.canPublish=false;f.context.canArchive=false
 f.render();await flush();f.render()
 const activate=()=>f.nodes.find(n=>n.props.children==='Activar versión')
 assert.equal(activate().props.disabled,true)
 assert.ok(!f.nodes.some(n=>n.props.children?.includes?.('Archivar')))
 f.context.canEdit=false;f.context.canPublish=true;f.render()
 assert.equal(activate().props.disabled,false)
 assert.equal(f.nodes.find(n=>n.type==='fieldset'&&n.props.disabled!==undefined).props.disabled,true)
 activate().props.onClick();f.render()
 assert.equal(f.nodes.find(n=>n.type?.name==='ConfirmDialog').props.open,true)
})
test('new and edit share photo controls and edit only one variant without losing another',async()=>{
 for(const id of [undefined,'p']){
  const f=editor(id);f.render();await flush();f.render()
  assert.ok(f.nodes.some(n=>n.type?.name==='ImageUploadDropzone'));assert.ok(!f.nodes.some(n=>n.props.type==='url'))
  if(id){
   const fields=()=>f.nodes.find(n=>n.type?.name==='PackageVariantFields'),first=fields();assert.equal(first.props.variant.id,'v1')
   first.props.onChange({...first.props.variant,name:'Modificado',price:'125'});f.render()
   f.nodes.find(n=>n.props['aria-label']==='Editar opción Grande').props.onClick();f.render();assert.equal(fields().props.variant.id,'v2')
   f.nodes.find(n=>n.props['aria-label']==='Editar opción Modificado').props.onClick();f.render();assert.equal(fields().props.variant.name,'Modificado');assert.equal(fields().props.variant.price,'125')
  }
 }
})
test('adding an option visibly selects a blank option and preserves the previous composition',()=>{
 const f=editor(),fields=()=>f.nodes.find(n=>n.type?.name==='PackageVariantFields');f.render()
 const first={...fields().props.variant,name:'80 unidades',price:'500',components:[{id:'c',productId:'service',presentationId:null,unitRevision:1,quantity:'1',weight:'1'}],choices:[{id:'q',name:'Sabores',totalQuantity:'80',maxDistinct:2,weight:'1',options:[]}]}
 fields().props.onChange(first);f.render()
 const add=()=>f.nodes.find(n=>n.props.children?.some?.(c=>c==='Agregar otra opción'))
 assert.ok(add(),'La acción debe decir qué agrega');add().props.onClick();f.render()
 const next=fields().props.variant;assert.notEqual(next.id,first.id);assert.equal(next.name,'');assert.equal(next.price,null);assert.deepEqual(next.components,[]);assert.deepEqual(next.choices,[])
 assert.equal(f.nodes.filter(n=>n.type?.name==='PackageVariantFields').length,1)
 assert.equal(f.nodes.find(n=>n.props['aria-label']==='Editar opción Opción 2').props['aria-pressed'],true)
 assert.match(f.nodes.find(n=>n.props.role==='status'&&n.props['aria-live']==='polite').props.children,/Opción 2 creada/)
 f.nodes.find(n=>n.props['aria-label']==='Editar opción 80 unidades').props.onClick();f.render();assert.deepEqual(fields().props.variant,first)
 assert.equal(f.nodes.find(n=>n.props['aria-label']==='Editar opción Opción 2').props['aria-pressed'],false)
 assert.equal(f.saves.length,0)
})
test('option creation stops at twenty and removing the selected option keeps the others',()=>{
 const f=editor();f.render()
 const add=()=>f.nodes.find(n=>n.props.children?.some?.(c=>c==='Agregar otra opción'))
 assert.ok(add())
 for(let i=1;i<20;i++){assert.equal(add().props.disabled,false);add().props.onClick();f.render()}
 assert.equal(add().props.disabled,true)
 f.nodes.find(n=>n.props['aria-label']==='Quitar opción seleccionada').props.onClick();f.render()
 assert.equal(add().props.disabled,false)
 assert.equal(f.nodes.filter(n=>n.props['aria-pressed']!==undefined&&n.props['aria-label']?.startsWith('Editar opción ')).length,19)
 assert.equal(f.nodes.filter(n=>n.props['aria-pressed']===true).length,1)
})
test('photo upload blocks saving, ignores replaced requests, recovers and guards photo-only drafts',async()=>{
 const f=editor('p');f.render();await flush();f.render()
 const drop=()=>f.nodes.find(n=>n.type?.name==='ImageUploadDropzone'),save=()=>f.nodes.find(n=>n.props.children?.some?.(v=>v==='Guardar borrador'))
 drop().props.onFileSelect(new File(['1'],'one.png',{type:'image/png'}));f.render();assert.equal(save().props.disabled,true);assert.equal(f.guards.at(-1),true)
 drop().props.onFileSelect(new File(['2'],'two.png',{type:'image/png'}));assert.equal(f.uploads[0].signal.aborted,true)
 f.uploads[0].resolve({imageUrl:'https://stale.invalid/one.webp'});f.uploads[1].reject(Error('Intenta nuevamente'));await flush();f.render();assert.equal(save().props.disabled,false);assert.ok(f.nodes.some(n=>n.props.role==='alert'&&n.props.children==='Intenta nuevamente'))
 drop().props.onFileSelect(new File(['3'],'three.png',{type:'image/png'}));f.uploads[2].resolve({imageUrl:'https://new.invalid/three.webp'});await flush();f.render();assert.equal(f.guards.at(-1),true);assert.ok(f.nodes.some(n=>n.props.src==='https://new.invalid/three.webp'))
 f.h.unmount()
})
test('unmounted package editor ignores an upload response and aborts the request',async()=>{
 const f=editor();f.render();f.nodes.find(n=>n.type?.name==='ImageUploadDropzone').props.onFileSelect(new File(['1'],'one.png',{type:'image/png'}));f.h.unmount();assert.equal(f.uploads[0].signal.aborted,true);f.uploads[0].resolve({imageUrl:'https://late.invalid/a.webp'});await flush();assert.equal(f.saves.length,0)
})
test('distribution weights remain editable behind advanced disclosure without changing historic values',()=>{
 const nodes=[],{PackageVariantFields}=loadReportModule('../inventory/packages/PackageVariantFields.tsx',{'./api':{}},nodes),changes=[]
 const variant={id:'v',name:'Uno',price:'100',components:[{id:'c',productId:null,presentationId:null,unitRevision:null,quantity:'1',weight:'27.5000'}],choices:[]}
 const html=renderToStaticMarkup(React.createElement(PackageVariantFields,{variant,index:0,scope,onChange:v=>changes.push(v)}))
 assert.match(html,/<summary[^>]*>Distribución del precio/);assert.match(html,/27.5000/)
 const advanced=nodes.find(n=>n.type==='details'&&n.props['aria-label']==='Distribución del precio');assert.equal(advanced.props.open,undefined)
 nodes.find(n=>n.props.id==='c-weight').props.onChange({target:{value:'0'}});assert.equal(changes[0].components[0].weight,'0');assert.equal(variant.components[0].weight,'27.5000')
})
test('summary keeps quantities visible without treating choice options as extra charges',async()=>{
 const f=editor('p');f.row.definition.variants[0].components=[{id:'c',quantity:'3',weight:'1'}];f.row.definition.variants[0].choices=[{id:'q',name:'Sabores',totalQuantity:'160',maxDistinct:4,weight:'1',options:[]}]
 f.render();await flush();f.render()
 const summary=f.nodes.find(n=>n.type==='aside'&&n.props['aria-label']==='Resumen del paquete')
 const html=renderToStaticMarkup(summary.props.children)
 assert.match(html,/3 × Artículo fijo 1/);assert.match(html,/160 a elegir · Sabores/);assert.match(html,/100/)
})

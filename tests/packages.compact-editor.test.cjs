const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'},flush=()=>new Promise(setImmediate)
function editor(id){
 const h=hookHarness(),nodes=[],guards=[],uploads=[],saves=[],row={id:'p',version:3,activeVersion:2,archivedAt:null,branchIds:['b'],definition:{schemaVersion:1,name:'Fiesta',description:'',currency:'GTQ',imageUrl:'https://old.invalid/image.png',variants:[{id:'v1',name:'Pequeño',price:'100',components:[],choices:[]},{id:'v2',name:'Grande',price:'200',components:[],choices:[]}]}}
 const {PackageEditor}=loadReportModule('../inventory/packages/PackageEditorPage.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}})},'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ'})},'@/modules/appointments/components/DraftGuard':{useDraftGuard:dirty=>{guards.push(dirty);return{dialog:null,request:fn=>fn(),proceed:fn=>fn()}}},'./api':{fetchPackage:async()=>structuredClone(row),packageQueryKey:()=>[],packageError:e=>e.message,savePackage:async(...args)=>{saves.push(args);return{id:'p'}},uploadPackageImage:(_scope,file,signal)=>new Promise((resolve,reject)=>uploads.push({file,signal,resolve,reject}))}},nodes)
 const context={scope,key:'a/b',canEdit:true,canRead:true,branches:[{id:'b',name:'Principal'},{id:'c',name:'Otra'}]}
 const render=()=>{nodes.length=0;h.render(()=>PackageEditor({context,id}));return nodes}
 return{h,nodes,render,guards,uploads,saves,row}
}
test('new and edit share photo controls and edit only one variant without losing another',async()=>{
 for(const id of [undefined,'p']){
  const f=editor(id);f.render();await flush();f.render()
  assert.ok(f.nodes.some(n=>n.type?.name==='ImageUploadDropzone'));assert.ok(!f.nodes.some(n=>n.props.type==='url'))
  if(id){
   const fields=()=>f.nodes.find(n=>n.type?.name==='PackageVariantFields'),first=fields();assert.equal(first.props.variant.id,'v1')
   first.props.onChange({...first.props.variant,name:'Modificado',price:'125'});f.render()
   f.nodes.find(n=>n.props.value==='v1'&&n.props.onValueChange).props.onValueChange('v2');f.render();assert.equal(fields().props.variant.id,'v2')
   f.nodes.find(n=>n.props.value==='v2'&&n.props.onValueChange).props.onValueChange('v1');f.render();assert.equal(fields().props.variant.name,'Modificado');assert.equal(fields().props.variant.price,'125')
  }
 }
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

const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const settle=()=>new Promise(r=>setImmediate(r))
const base={schemaVersion:1,purpose:'FEL_INVOICE',paper:{format:'LETTER',margin:36},base:{id:'CLASSIC',version:2},themeOverrides:{},blocks:[]}
function editor({canManage=true,compile=async()=>({design:structuredClone(base),source:'<normalized/>'}),purpose='FEL_INVOICE'}={}){
  const h=hookHarness(),nodes=[],downloads=[],exports=[],errors=[],inputs=[],paths=[],notices=[],actions=[]
  const draft={design:{...structuredClone(base),purpose},schema:{theme:{fontFamily:['Helvetica'],fontSize:[9,14],spacing:[2,16]},limits:{xmlBytes:262144},fiscalEnabled:false},row:{id:'T',purpose,format:'LETTER',source:'<original/>',status:'DRAFT',version:1},name:'Diseño',loading:false,pending:false,error:'',dirty:false,signal:new AbortController().signal,setError:message=>{draft.error=message;errors.push(message)},setDesign:design=>{draft.design=design;draft.dirty=true},setName(){},save:()=>assert.fail('No save without user action')}
  draft.acceptSaved=row=>{draft.row=row;draft.dirty=false}
  const api={compileTemplate:(scope,input)=>{inputs.push(input);return compile(scope,input)},assertTemplateScope(){},exportTemplateXml:async()=>{exports.push('GET');return '<saved/>'},templateAction:async(...args)=>{actions.push(args);return {...draft.row,version:2}}}
  const {TemplateEditor}=loadReportModule('../config/documentTemplates/TemplateEditor.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>to=>paths.push(to),Link:'a'},'@/hooks/use-toast':{toast:notice=>notices.push(notice)},'./useTemplateDraft':{useTemplateDraft:()=>draft},'./useTemplateLeaveGuard':{useTemplateLeaveGuard:()=>()=>true},'./TemplatePreview':{downloadDocumentBlob:(_scope,blob)=>downloads.push(blob),TemplatePreview:()=>null},'./api':api},nodes)
  const render=()=>{nodes.length=0;return h.render(()=>TemplateEditor({scope:{companyId:'A',branchId:'B',userId:'U',sessionId:'S'},id:'T',canManage,canPublish:false,companyName:'QA',registerGuard:()=>()=>{}}))}
  return {h,nodes,draft,downloads,exports,errors,inputs,paths,notices,actions,render,code:()=>nodes.find(n=>n.props.onValidate)}
}
test('editor shows precise XML errors, clears stale diagnostics when typing and then applies valid XML',async()=>{
  let invalid=false
  const e=editor({compile:async inputScope=>{if(invalid)throw Object.assign(Error('Ancho inválido'),{data:{diagnostics:[{path:'column.width',line:5,column:9,message:'Ancho inválido'}]}});return {design:structuredClone(base),source:'<normalized/>'}}})
  try{
    e.render();e.nodes.find(n=>n.props.children==='Código XML').props.onClick();await settle();e.render()
    e.code().props.onChange('<bad/>');e.render();invalid=true;e.code().props.onValidate();await settle();e.render()
    assert.equal(e.code().props.diagnostics[0].line,5);assert.equal(e.draft.error,'Ancho inválido')
    assert.ok(e.nodes.find(n=>n.type.displayName==='Alert'&&n.props.variant==='destructive'),'XML diagnostics use the system alert')
    e.code().props.onChange('<good/>');e.render();assert.deepEqual(e.code().props.diagnostics,[]);assert.equal(e.draft.error,'')
    invalid=false;e.code().props.onValidate();await settle();e.render();assert.equal(e.code().props.value,'<normalized/>');assert.deepEqual(e.code().props.diagnostics,[]);assert.equal(e.inputs.at(-1).source,'<good/>')
    assert.match(e.notices.at(-1).title,/XML válido/)
  }finally{e.h.unmount()}
})
test('editor resets a base only after accepting the Auna confirmation',async()=>{
  const e=editor()
  try{
    e.render();e.nodes.find(n=>n.props.children==='Apariencia'&&n.props.onClick).props.onClick();e.render()
    e.nodes.find(n=>n.props.children==='Restablecer base').props.onClick();e.render();assert.equal(e.actions.length,0)
    let dialog=e.nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open);assert.ok(dialog);assert.equal(dialog.props.appearance,'auna')
    dialog.props.onOpenChange(false);await settle();e.render();assert.equal(e.actions.length,0)
    e.nodes.find(n=>n.props.children==='Restablecer base').props.onClick();e.render();e.nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open).props.onConfirm();await settle();e.render()
    assert.equal(e.actions.length,1);assert.equal(e.actions[0][2],'reset');assert.match(e.notices.at(-1).title,/Base restablecida/)
  }finally{e.h.unmount()}
})
test('importing a different purpose into an existing design keeps the original and explains how to create another',async()=>{
  const e=editor({purpose:'INTERNAL_RECEIPT'}),original=e.draft.design
  try{
    e.render();await e.nodes.find(n=>n.props.type==='file').props.onChange({target:{files:[new File(['<fiscal/>'],'fiscal.xml')],value:'fiscal.xml'}});e.render()
    // The file handler starts an async operation; let its read/validation complete.
    await new Promise(r=>setImmediate(r));e.render()
    assert.equal(e.draft.design,original);assert.match(e.draft.error,/Carta sí coincide/);assert.match(e.draft.error,/comprobante interno/i);assert.match(e.draft.error,/factura FEL/i);assert.equal(e.code().props.value,'<fiscal/>')
    e.nodes.find(n=>n.props.children==='Crear factura FEL en Carta').props.onClick()
    const target=new URL(e.paths[0],'http://localhost');assert.equal(target.pathname,'/configuracion/plantillas/nueva');assert.equal(target.searchParams.get('tipo'),'FEL_INVOICE');assert.equal(target.searchParams.get('formato'),'LETTER')
    assert.equal(e.draft.design,original)
  }finally{e.h.unmount()}
})
test('a format mismatch identifies both sizes and never claims Carta matches a ticket',async()=>{
  const e=editor({compile:async()=>({design:{...structuredClone(base),paper:{format:'RECEIPT_80',margin:12}},source:'<ticket/>'})})
  try{
    e.render();e.nodes.find(n=>n.props.type==='file').props.onChange({target:{files:[new File(['<ticket/>'],'ticket.xml')],value:''}});await settle();e.render()
    assert.match(e.draft.error,/Carta/);assert.match(e.draft.error,/80 mm/);assert.doesNotMatch(e.draft.error,/sí coincide/)
    e.code().props.onChange('<edited/>');e.render();assert.equal(e.draft.error,'');assert.equal(e.nodes.some(n=>typeof n.props.children==='string'&&n.props.children.startsWith('Crear factura FEL en ')),false)
  }finally{e.h.unmount()}
})
test('Carta FEL imports normally into a matching template or a new unsaved design',async()=>{
  for(const saved of [true,false]){
    const e=editor({purpose:saved?'FEL_INVOICE':'INTERNAL_RECEIPT'})
    if(!saved)e.draft.row=undefined
    try{
      e.render();e.nodes.find(n=>n.props.type==='file').props.onChange({target:{files:[new File(['<fiscal/>'],'fiscal.xml')],value:''}});await settle();e.render()
      assert.equal(e.draft.error,'');assert.equal(e.draft.design.purpose,'FEL_INVOICE');assert.equal(e.draft.design.paper.format,'LETTER');assert.equal(e.code().props.value,'<normalized/>')
      assert.equal(e.nodes.some(n=>typeof n.props.children==='string'&&n.props.children.startsWith('Crear factura FEL en ')),false)
    }finally{e.h.unmount()}
  }
})
test('read-only editor exports saved XML without calling the manager compiler',async()=>{
  const e=editor({canManage:false,compile:()=>assert.fail('Do not compile with read-only permissions')})
  try{e.render();e.nodes.find(n=>n.props.children==='Exportar XML').props.onClick();await settle();assert.deepEqual(e.exports,['GET']);assert.equal(await e.downloads[0].text(),'<saved/>')}finally{e.h.unmount()}
})
test('visual section navigation does not compile or mutate the draft and generation belongs to preview',()=>{
  const e=editor(),original=e.draft.design
  try{
    e.render();const columns=e.nodes.find(n=>n.props.children==='Columnas'&&n.props.onClick);assert.ok(columns)
    columns.props.onClick();e.render();assert.equal(e.nodes.find(n=>n.type.name==='TemplateBlocks').props.section,'columns')
    e.nodes.find(n=>n.props.children==='Apariencia'&&n.props.onClick).props.onClick();e.render()
    assert.equal(e.nodes.some(n=>n.type.name==='TemplateBlocks'),false)
    e.nodes.find(n=>n.props.children==='Notas y pie'&&n.props.onClick).props.onClick();e.render()
    assert.equal(e.nodes.find(n=>n.type.name==='TemplateBlocks').props.section,'footer')
    assert.equal(e.draft.design,original);assert.equal(e.inputs.length,0)
    assert.ok(e.nodes.find(n=>n.props.pdf===null&&'stale'in n.props).props.actions)
  }finally{e.h.unmount()}
})

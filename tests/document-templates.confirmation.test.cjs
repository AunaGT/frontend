const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const settle=()=>new Promise(resolve=>setImmediate(resolve))
test('template confirmations wait for the Auna dialog, cancel safely and resolve only once',async()=>{
  const h=hookHarness(),nodes=[]
  const {useTemplateConfirmation}=loadReportModule('../config/documentTemplates/useTemplateConfirmation.tsx',{react:h.hooks},nodes)
  const render=()=>h.render(()=>useTemplateConfirmation())
  try{
    let ui=render(),resolved=false
    const choice=ui.confirm({title:'Archivar diseño',description:'Conserva los documentos anteriores.',confirmText:'Archivar'}).then(value=>{resolved=true;return value})
    ui=render();assert.equal(resolved,false);assert.equal(ui.dialog.props.appearance,'auna');assert.equal(ui.dialog.props.open,true)
    assert.equal(await ui.confirm({title:'Otra acción',description:'No reemplazar la primera.'}),false)
    ui.dialog.props.onOpenChange(false);assert.equal(await choice,false)
    const accepted=ui.confirm({title:'Restablecer',description:'Se descartan los cambios.'});ui=render()
    ui.dialog.props.onConfirm();assert.equal(await accepted,true);assert.equal(render().dialog.props.open,false)
    const abandoned=ui.confirm({title:'Salir',description:'Hay cambios.'});h.unmount();assert.equal(await abandoned,false)
  }finally{h.unmount()}
})
test('archiving a template requires system confirmation and reports success without native alerts',async()=>{
  const h=hookHarness(),nodes=[],actions=[],notices=[],scope={companyId:'A',branchId:'B',userId:'U',sessionId:'S'},prior=global.window
  global.window={confirm:()=>assert.fail('No native confirmation')}
  const context={scope,key:'A',canRead:true,canManage:true,canPublish:true,companyName:'QA',registerGuard:()=>()=>{}}
  const Page=loadReportModule('../config/pages/DocumentTemplatesPage.tsx',{react:h.hooks,'react-router-dom':{useNavigate:()=>()=>{}},'@/components/layout/PageNavigation':{usePageTrail(){}},'@/hooks/use-toast':{toast:notice=>notices.push(notice)},'../documentTemplates/TemplateAppearance':{TemplateAppearance:()=>null},'../documentTemplates/useTemplateScope':{useTemplateScope:()=>context},'../documentTemplates/api':{listTemplates:async()=>({rows:[{id:'T',name:'Mi diseño',format:'LETTER',purpose:'INTERNAL_RECEIPT',state:'ACTIVE',status:'DRAFT',version:2}],total:1}),templateSchema:async()=>({bases:[]}),templateAction:async(...args)=>actions.push(args)}},nodes).default
  const element=Page(),render=()=>{nodes.length=0;return h.render(()=>element.type(element.props))}
  try{
    render();await settle();render()
    nodes.find(n=>n.props.children==='Archivar').props.onClick();render();assert.equal(actions.length,0)
    let dialog=nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open);assert.ok(dialog,'Auna confirmation must open before archive');assert.equal(dialog.props.appearance,'auna')
    dialog.props.onOpenChange(false);await settle();render();assert.equal(actions.length,0)
    nodes.find(n=>n.props.children==='Archivar').props.onClick();render();nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open).props.onConfirm();await settle();render()
    assert.equal(actions.length,1);assert.equal(actions[0][1],'T');assert.equal(actions[0][2],'archive');assert.deepEqual(actions[0][3],{expectedVersion:2});assert.match(notices.at(-1).title,/archivad/i)
  }finally{h.unmount();global.window=prior}
})
test('appearance reset is confirmed through Auna and cancel preserves edited values',async()=>{
  const h=hookHarness(),nodes=[],scope={companyId:'A',branchId:'B',userId:'U',sessionId:'S'},prior={window:global.window,document:global.document}
  global.window={addEventListener(){},removeEventListener(){},confirm:()=>assert.fail('No native confirmation')};global.document={addEventListener(){},removeEventListener(){}}
  const {TemplateAppearance}=loadReportModule('../config/documentTemplates/TemplateAppearance.tsx',{react:{...h.hooks,useContext:()=>null},'./api':{readAppearance:async()=>({values:{headerText:'Original'},revision:1})}},nodes)
  const render=()=>{nodes.length=0;return h.render(()=>TemplateAppearance({scope,canManage:true,registerGuard:()=>()=>{}}))}
  try{
    render();await settle();render();nodes.find(n=>n.props.placeholder==='Comprobante interno').props.onChange({target:{value:'Nuevo'}});render()
    nodes.find(n=>n.props.children==='Restablecer cambios').props.onClick();render();nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open).props.onOpenChange(false);await settle();render();assert.equal(nodes.find(n=>n.props.placeholder==='Comprobante interno').props.value,'Nuevo')
    nodes.find(n=>n.props.children==='Restablecer cambios').props.onClick();render();nodes.find(n=>n.type.name==='ConfirmDialog'&&n.props.open).props.onConfirm();await settle();render();assert.equal(nodes.find(n=>n.props.placeholder==='Comprobante interno').props.value,'Original')
  }finally{h.unmount();Object.assign(global,prior)}
})

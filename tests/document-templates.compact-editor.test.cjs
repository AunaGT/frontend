const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
function setup({disabled=false}={}){
  const h=hookHarness(),nodes=[],writes=[],uploads=[]
  let design={schemaVersion:1,purpose:'INTERNAL_RECEIPT',paper:{format:'LETTER',margin:36},base:{id:'CLASSIC',version:2},themeOverrides:{},blocks:[
    {id:'header',kind:'HEADER',settings:{title:'Mi negocio',showLogo:true,alignment:'left'}},
    {id:'emitter',kind:'EMITTER',settings:{}},{id:'receiver',kind:'RECEIVER',settings:{}},
    {id:'details',kind:'DETAILS',settings:{columns:['quantity','description','price','total'],columnStyles:{description:{label:'Detalle',align:'left'}}}},
    {id:'totals',kind:'TOTALS',settings:{}},{id:'notes',kind:'NOTES',settings:{text:'Mi nota'}},
    {id:'footer',kind:'FOOTER',settings:{text:'Hasta pronto'}},
  ]}
  const schema={columns:['quantity','description','price','total'],conditions:['ALWAYS','HAS_NOTE'],blocks:Object.fromEntries(design.blocks.map(b=>[b.kind,{required:b.kind!=='NOTES',settings:b.kind==='HEADER'?{alignment:['left','center','right']}:{}}]))}
  const {TemplateBlocks}=loadReportModule('../config/documentTemplates/TemplateBlocks.tsx',{react:h.hooks},nodes)
  const render=(section='header')=>{nodes.length=0;return h.render(()=>TemplateBlocks({design,schema,section,disabled,onChange:next=>{design=next;writes.push(next)},onImage:(...args)=>uploads.push(args)}))}
  return {h,nodes,writes,uploads,render,get design(){return design}}
}
test('compact header hides other sections instead of mounting every block form',()=>{
  const e=setup()
  try{
    e.render();assert.ok(e.nodes.some(n=>n.props.maxLength===2000&&n.props.value==='Mi negocio'))
    assert.equal(e.nodes.some(n=>n.props['aria-label']==='Título de Descripción'),false)
    assert.equal(e.nodes.filter(n=>n.type==='textarea').length,0)
    assert.equal(e.nodes.filter(n=>n.type==='input'&&n.props.type==='file').length,0)
    assert.equal(e.design.blocks.length,7)
  }finally{e.h.unmount()}
})
test('columns disclose one editor at a time and preserve values when switching and reordering',()=>{
  const e=setup()
  try{
    e.render('columns');assert.equal(e.nodes.filter(n=>n.props['aria-label']?.startsWith('Título de ')).length,1)
    e.nodes.find(n=>n.props['aria-label']==='Título de Descripción').props.onChange({target:{value:'Concepto'}});e.render('columns')
    e.nodes.find(n=>n.props['aria-label']==='Editar columna Importe').props.onClick();e.render('columns')
    assert.ok(e.nodes.find(n=>n.props['aria-label']==='Título de Importe'));assert.equal(e.nodes.some(n=>n.props['aria-label']==='Título de Descripción'),false)
    e.nodes.find(n=>n.props['aria-label']==='Subir Importe').props.onClick();e.render('columns')
    assert.deepEqual(e.design.blocks[3].settings.columns,['quantity','description','total','price'])
    assert.deepEqual(e.design.blocks[3].settings.columnStyles.description,{label:'Concepto',align:'left'})
    e.render('footer');e.render('columns');assert.equal(e.design.blocks[3].settings.columnStyles.description.label,'Concepto')
  }finally{e.h.unmount()}
})
test('images show only used slots, allocate unused slots and remove only the selected association',()=>{
  const e=setup()
  try{
    e.render('images');assert.equal(e.nodes.filter(n=>n.props.type==='file').length,0)
    e.nodes.find(n=>n.props['aria-label']==='Agregar imagen a Cabecera').props.onClick();e.render('images')
    assert.deepEqual(e.design.blocks[0].settings.images,['imagen-1'])
    e.nodes.find(n=>n.props['aria-label']==='Agregar imagen a Pie del documento').props.onClick();e.render('images')
    assert.deepEqual(e.design.blocks[6].settings.images,['imagen-2'])
    assert.equal(e.nodes.filter(n=>n.props.type==='file').length,2)
    e.nodes.find(n=>n.props['aria-label']==='Quitar imagen 1 de Cabecera').props.onClick();e.render('images')
    assert.deepEqual(e.design.blocks[0].settings.images,[]);assert.deepEqual(e.design.blocks[6].settings.images,['imagen-2'])
  }finally{e.h.unmount()}
})
test('read-only design keeps inspection/navigation available without editable column fields',()=>{
  const e=setup({disabled:true})
  try{e.render('columns');assert.ok(e.nodes.find(n=>n.props['aria-label']==='Título de Descripción'));for(const n of e.nodes.filter(n=>n.props['aria-label']?.startsWith('Título de ')||n.props['aria-label']?.startsWith('Subir ')))assert.equal(n.props.disabled,true)}finally{e.h.unmount()}
})
test('an existing image slot can be reused at the resource limit without another upload',()=>{
  const e=setup()
  try{
    e.design.blocks[0].settings.images=['imagen-1','imagen-2','imagen-3','imagen-4'];e.render('images')
    assert.equal(e.nodes.find(n=>n.props['aria-label']==='Agregar imagen a Pie del documento').props.disabled,true)
    const reuse=e.nodes.find(n=>n.props['aria-label']==='Reutilizar imagen en Pie del documento');assert.ok(reuse)
    reuse.props.onChange({target:{value:'imagen-1'}});e.render('images')
    assert.deepEqual(e.design.blocks[6].settings.images,['imagen-1']);assert.equal(e.uploads.length,0)
    e.nodes.find(n=>n.props['aria-label']==='Quitar imagen 1 de Cabecera').props.onClick();e.render('images')
    assert.deepEqual(e.design.blocks[6].settings.images,['imagen-1'])
  }finally{e.h.unmount()}
})
test('logo reserves one resource and removing an association makes its free slot available again',()=>{
  const e=setup()
  try{
    for(let i=0;i<4;i++){e.render('images');e.nodes.find(n=>n.props['aria-label']==='Agregar imagen a Cabecera').props.onClick()}
    e.render('images');assert.equal(e.nodes.find(n=>n.props['aria-label']==='Agregar imagen a Cabecera').props.disabled,true)
    assert.deepEqual(e.design.blocks[0].settings.images,['imagen-1','imagen-2','imagen-3','imagen-4'])
    e.nodes.find(n=>n.props['aria-label']==='Quitar imagen 2 de Cabecera').props.onClick();e.render('images')
    e.nodes.find(n=>n.props['aria-label']==='Agregar imagen a Pie del documento').props.onClick();e.render('images')
    assert.deepEqual(e.design.blocks[6].settings.images,['imagen-2'])
  }finally{e.h.unmount()}
})
test('preview owns its generation actions beside the actual document viewer',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const {TemplatePreview}=loadReportModule('../config/documentTemplates/TemplatePreview.tsx',{'./api':{assertTemplateScope(){}}})
  const html=renderToStaticMarkup(React.createElement(TemplatePreview,{scope:{companyId:'A'},pdf:null,pending:false,stale:false,actions:React.createElement('button',null,'Generar muestra')}))
  assert.match(html,/aria-label="Vista previa del documento"/);assert.match(html,/Generar muestra/)
})

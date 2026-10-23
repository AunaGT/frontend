const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const flush=()=>new Promise(r=>setImmediate(r))
const design={schemaVersion:1,purpose:'INTERNAL_RECEIPT',paper:{format:'A4',margin:36},base:{id:'CLASSIC',version:1},themeOverrides:{},blocks:[]}
function setup({save=async input=>({id:'T',version:2,design:input.design,name:input.name,source:'XML',status:'DRAFT'})}={}){
  const h=hookHarness(),writes=[]
  const api={templateSchema:async()=>({presets:{CLASSIC:{LETTER:design}}}),getTemplate:async()=>({id:'T',version:1,design,name:'Diseño',source:'XML',status:'DRAFT'}),saveTemplate:async(scope,input)=>{writes.push(input);return save(input)}}
  const {useTemplateDraft}=loadReportModule('../config/documentTemplates/useTemplateDraft.ts',{react:h.hooks,'./api':api,'@/modules/config/documentTemplates/api':api})
  const scope={companyId:'A',branchId:'B',userId:'U',sessionId:'S'}
  const render=()=>h.render(()=>useTemplateDraft({scope,id:'T'}))
  return {h,writes,render}
}
test('saving an edited draft does not publish; conflict keeps local fields intact',async()=>{
  const app=setup({save:async()=>{throw Object.assign(new Error('Conflicto'),{status:409})}});app.render();await flush()
  let draft=app.render();draft.setName('Mi cambio');draft=app.render();await draft.save();draft=app.render()
  assert.equal(draft.name,'Mi cambio');assert.equal(draft.dirty,true);assert.equal(draft.error,'Conflicto')
  assert.equal(app.writes[0].expectedVersion,1);assert.ok(app.writes[0].requestKey)
  app.h.unmount()
})
test('new pending-invoice editor chooses the FEL preset rather than silently using an internal receipt',async()=>{
  const h=hookHarness(),fiscal={...design,purpose:'FEL_INVOICE'},api={templateSchema:async()=>({presets:{CLASSIC:{LETTER:design}},fiscalPresets:{CLASSIC:{LETTER:fiscal}}})}
  const {useTemplateDraft}=loadReportModule('../config/documentTemplates/useTemplateDraft.ts',{react:h.hooks,'./api':api})
  const render=()=>h.render(()=>useTemplateDraft({scope:{companyId:'A',branchId:'B',userId:'U',sessionId:'S'},purpose:'FEL_INVOICE'}))
  render();await flush();assert.equal(render().design.purpose,'FEL_INVOICE');h.unmount()
})
test('visual editor changes column title and width without dropping imported alignment or mandatory columns',()=>{
  const nodes=[],writes=[],d={...design,base:{id:'CLASSIC',version:2},blocks:[{id:'details',kind:'DETAILS',settings:{columns:['quantity','description','price','total'],columnStyles:{description:{label:'Detalle',align:'left',width:40}}}}]},schema={columns:['quantity','description','price','total'],blocks:{DETAILS:{required:true,settings:{columns:'columns',columnStyles:'columnStyles'}}}}
  const h=hookHarness(),{TemplateBlocks}=loadReportModule('../config/documentTemplates/TemplateBlocks.tsx',{react:h.hooks},nodes)
  h.render(()=>TemplateBlocks({design:d,schema,section:'columns',disabled:false,onChange:next=>writes.push(next)}))
  const title=nodes.find(n=>n.props['aria-label']==='Título de Descripción');assert(title)
  title.props.onChange({target:{value:'Mi detalle'}})
  assert.equal(writes[0].blocks[0].settings.columnStyles.description.label,'Mi detalle');assert.equal(writes[0].blocks[0].settings.columnStyles.description.align,'left')
  assert.deepEqual(writes[0].blocks[0].settings.columns,['quantity','description','price','total'])
  const width=nodes.find(n=>n.props['aria-label']==='Ancho de Descripción');assert(width);width.props.onChange({target:{value:'44'}})
  assert.equal(writes[1].blocks[0].settings.columnStyles.description.width,44)
  h.unmount()
})

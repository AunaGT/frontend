const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
const flush=()=>new Promise(r=>setImmediate(r))
test('an unmounted editor cannot accept a late saved draft or publish with its old handler',async()=>{
  const h=hookHarness();let resolve,writes=0
  const design={schemaVersion:1,paper:{format:'A4'},blocks:[]}
  const api={templateSchema:async()=>({presets:{CLASSIC:{LETTER:design}}}),getTemplate:async()=>({id:'T',version:1,name:'Original',design,source:'XML'}),saveTemplate:async()=>{writes++;return new Promise(r=>resolve=r)}}
  const {useTemplateDraft}=loadReportModule('../config/documentTemplates/useTemplateDraft.ts',{react:h.hooks,'./api':api})
  const render=()=>h.render(()=>useTemplateDraft({scope:{companyId:'A',branchId:'B',userId:'U',sessionId:'S'},id:'T'}))
  render();await flush();let draft=render();draft.setName('Cambio');draft=render();const saving=draft.save()
  h.unmount();resolve({id:'old',version:2,name:'Cambio',design,source:'XML'})
  assert.equal(await saving,null);assert.equal(await draft.save(),null);assert.equal(writes,1)
})

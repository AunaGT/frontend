const test=require('node:test'),assert=require('node:assert/strict'),{configHarness,flush}=require('./helpers/configHarness.cjs')
const context={userId:'U',companyId:'A',branchId:'BA',ready:true,canRead:true,canManage:true,consolidated:false}
test('a section save never couples a new revision with a different section old value',async()=>{
  const writes=[],h=configHarness({getSettings:async()=>({company_name:'Anterior',company_nit:'NIT-A',_revisions:{company_name:2,company_nit:3}}),updateSettings:async(p,o)=>{writes.push([p,o]);return{...p,company_nit:'NIT-B',_revisions:{company_name:3,company_nit:4}}}},context)
  try{h.render();await flush();h.render();h.value().setField('empresa','company_name','Nuevo');h.render();assert.equal(await h.value().save('empresa'),'saved');h.render()
    assert.deepEqual(writes[0][1].expectedRevisions,{company_name:2})
    assert.equal(h.value().confirmed._revisions.company_nit,3);assert.equal(h.value().confirmed.company_nit,'NIT-A')
  }finally{h.unmount()}
})
test('conflict retains the draft; confirmed section reload preserves other sections and revisions',async()=>{
  let loads=0
  const h=configHarness({getSettings:async()=>({company_name:++loads===1?'Original':'Remoto',company_nit:'Original fiscal',_revisions:{company_name:loads,company_nit:1}}),updateSettings:async()=>{throw Object.assign(Error('Conflicto'),{status:409})}},context)
  try{h.render();await flush();h.render();h.value().setField('empresa','company_name','Mío');h.value().setField('fiscal','company_nit','Fiscal pendiente');h.render()
    assert.equal(await h.value().save('empresa'),'failed');h.render();assert.equal(h.value().drafts.empresa.company_name,'Mío')
    await h.value().reloadSection('empresa');h.render();assert.equal(h.value().drafts.empresa.company_name,'Remoto');assert.equal(h.value().drafts.fiscal.company_nit,'Fiscal pendiente');assert.equal(h.value().dirty('fiscal'),true)
  }finally{h.unmount()}
})

const test=require('node:test'),assert=require('node:assert/strict')
const {integrationView,scope,context}=require('./helpers/integrationViewHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const empty={q:'',status:'ALL',scope:'ALL'}
test('filter controls submit explicit criteria and clear without sending pasted secrets',()=>{
 const applied=[],f=integrationView('../config/integrations/CredentialFilters.tsx','CredentialFilters',{value:empty,onApply:value=>applied.push(value),disabled:false})
 let html=f.render();assert.match(html,/auna-control/);assert.match(html,/Buscar claves/)
 f.nodes.find(n=>n.type==='input').props.onChange({target:{value:'Web'}});f.render()
 f.nodes.find(n=>typeof n.props.onValueChange==='function').props.onValueChange('PAUSED');f.render()
 f.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.deepEqual(applied[0],{q:'Web',status:'PAUSED',scope:'ALL'})
 f.nodes.find(n=>n.type==='input').props.onChange({target:{value:'Authorization: Bearer auna_live_PRIVATE'}});f.render()
 f.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 html=f.render();assert.equal(applied.length,1);assert.doesNotMatch(html,/auna_live_PRIVATE/);assert.match(html,/identificador público/)
 f.nodes.find(n=>n.props.children==='Limpiar').props.onClick();assert.deepEqual(applied[1],empty)
 f.unmount()
})
test('list transport never sends a pasted key or broadens an applied filter',async()=>{
 const calls=[],{listKeys}=loadReportModule('../config/integrations/api.ts',{'@/services/api':{apiFetch:async(path,opts)=>{calls.push({path,opts});return{items:[],total:0}},getActiveCompanyId:()=> 'c',getActiveBranchId:()=> 'b'},'@/services/authSession':{authSessionIdentity:()=> 's',authSessionMatches:()=>true}})
 await assert.rejects(()=>listKeys(scope,1,undefined,{...empty,q:'auna_live_PRIVATE'}));assert.equal(calls.length,0)
 await listKeys(scope,2,undefined,{q:'Web Norte',status:'PAUSED',scope:'products.read'})
 const query=new URL(calls[0].path,'https://invalid.test').searchParams
 assert.equal(query.get('page'),'2');assert.equal(query.get('q'),'Web Norte');assert.equal(query.get('status'),'PAUSED');assert.equal(query.get('scope'),'products.read')
 assert.equal(calls[0].opts.retryUnauthorized,false)
})
test('library distinguishes no matches and resets pagination when filters are applied',async()=>{
 const calls=[],f=integrationView('../config/pages/IntegrationsPage.tsx','IntegrationLibrary',{context:{...context,canManage:false}},
 {'../integrations/IntegrationSettingsLayout':{IntegrationSettingsLayout:({children})=>children},'../integrations/IntegrationUsage':{IntegrationUsage:()=>null},'../integrations/CredentialFilters':{CredentialFilters:()=>null},'../integrations/api':{listKeys:async(_s,page,_a,filters)=>{calls.push({page,filters});return{items:[],total:0}},integrationError:()=> 'Error'}})
 f.render();await f.flush();assert.match(f.render(),/auna-empty-state-art/)
 let filter=f.nodes.find(n=>typeof n.props.onApply==='function')
 filter.props.onApply({q:'missing',status:'ALL',scope:'ALL'});f.render();await f.flush()
 const html=f.render();assert.match(html,/Sin coincidencias/);assert.doesNotMatch(html,/Crear primera clave/)
 assert.equal(calls.at(-1).page,1);assert.equal(calls.at(-1).filters.q,'missing');f.unmount()
})

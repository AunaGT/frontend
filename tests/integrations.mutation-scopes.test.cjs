const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('mutation scopes never auto-grant read or customer creation, and missing read is actionable',()=>{
 const {initialCredentialInput,withScopes,hasDraftScope,validateCredentialInput,scopeGroups}=loadReportModule('../config/integrations/model.ts')
 for(const type of ['quotes','orders'])for(const action of ['update_draft','cancel_draft']){
  const scope=type+'.'+action,input={...initialCredentialInput('u'),name:'Web',branchIds:['b']},next=withScopes(input,[scope])
  assert.deepEqual(next.scopes,[scope]);assert.equal(next.customerPolicy,'EXISTING_ONLY');assert.equal(next.customerPaymentTermId,null);assert.equal(hasDraftScope(next.scopes),false)
  assert.match(validateCredentialInput(next),/selecciona también.*Consultar/)
  assert.equal(validateCredentialInput(withScopes(next,[scope,type+'.read'])),'')
  assert.ok(scopeGroups.some(g=>g.scopes.includes(scope)))
 }
})
function harness({replace=false}={}){
 let index=0,calls=0;const values=[],effects=[],seen=new Set(),nodes=[]
 const state=initial=>{const key=index++;if(!(key in values))values[key]=typeof initial==='function'?initial():initial;return[values[key],next=>values[key]=typeof next==='function'?next(values[key]):next]}
 const {CredentialForm}=loadReportModule('../config/integrations/CredentialForm.tsx',{
  react:{...React,useState:state,useRef:initial=>state(()=>({current:initial}))[0],useEffect:effect=>{const key=index++;if(!seen.has(key)){seen.add(key);effects.push(effect)}}},
  'react-router-dom':{Link:({to,children})=>React.createElement('a',{href:to},children)},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',timezone:'America/Guatemala'})},
  '../documentTemplates/useTemplateConfirmation':{useTemplateConfirmation:()=>({dialog:null,confirm:async()=>true})},
  './api':{getOptions:async()=>({owners:[{id:'u',name:'Ana'}],branches:[{id:'b',name:'Principal'}],scopes:['quotes.read','quotes.update_draft','quotes.cancel_draft'],hasMore:false}),getKey:async()=>({id:'key',integrationId:'i',owner:{id:'u'},name:'Web',scopes:['quotes.read'],branches:[{id:'b'}],customerPolicy:'EXISTING_ONLY',customerPaymentTermId:null}),createKey:async()=>{calls++;throw Error('must not submit invalid permissions')},integrationError:()=>''}
 },nodes)
 const render=()=>{index=0;nodes.length=0;return renderToStaticMarkup(React.createElement(CredentialForm,{context:{scope:{userId:'u'},key:'k',canManage:true,readOnly:false},replaceId:replace?'key':undefined}))}
 const mount=async()=>{render();for(const e of effects.splice(0))e();await new Promise(r=>setImmediate(r));return render()}
 const toggle=(scope,checked)=>{nodes.find(n=>n.props.id==='integration-scope-'+scope).props.onChange({target:{checked}});return render()}
 return{nodes,render,mount,toggle,get calls(){return calls}}
}
test('real scope handlers show inline read dependency and removing read blocks submit',async()=>{
 const f=harness();await f.mount()
 f.nodes.find(n=>n.props.id==='integration-name').props.onChange({target:{value:'Web'}});f.render()
 f.nodes.find(n=>n.type==='input'&&n.props.type==='checkbox'&&!n.props.id).props.onChange({target:{checked:true}});f.render()
 const html=f.toggle('quotes.update_draft',true)
 assert.match(html,/selecciona también.*Consultar cotizaciones propias/);assert.match(html,/role="alert"/)
 assert.equal(f.nodes.find(n=>n.props.id==='integration-scope-quotes.read').props.checked,false)
 assert.doesNotMatch(html,/Crear clientes|Registrar clientes al crear/)
 f.toggle('quotes.read',true);assert.equal(f.nodes.find(n=>n.props.id==='integration-scope-quotes.update_draft').props.checked,true)
 f.toggle('quotes.read',false);f.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 await new Promise(r=>setImmediate(r));assert.equal(f.calls,0)
})
test('replacement cannot gain newly introduced scopes',async()=>{
 const f=harness({replace:true}),html=await f.mount()
 assert.match(html,/Consultar cotizaciones propias/)
 assert.equal(f.nodes.some(n=>n.props.id==='integration-scope-quotes.update_draft'),false)
 assert.equal(f.nodes.some(n=>n.props.id==='integration-scope-quotes.cancel_draft'),false)
})

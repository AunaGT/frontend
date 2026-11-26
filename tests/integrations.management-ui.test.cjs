const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('creation defaults to ninety days but grants no data or branches until explicitly selected',()=>{
 const {initialCredentialInput,validateCredentialInput}=loadReportModule('../config/integrations/model.ts'),input=initialCredentialInput('owner')
 assert.equal(input.days,90);assert.deepEqual(input.scopes,[]);assert.deepEqual(input.branchIds,[])
 assert.ok(validateCredentialInput(input));assert.equal(validateCredentialInput({...input,name:'Web',scopes:['products.read'],branchIds:['b']}),'')
 for(const days of [0,366,1.5])assert.ok(validateCredentialInput({...input,name:'Web',scopes:['products.read'],branchIds:['b'],days}))
})
test('one-shot key display uses no link or automatic copy and can be explicitly cleared',()=>{
 const nodes=[],{OneShotKey}=loadReportModule('../config/integrations/OneShotKey.tsx',{},nodes);let hidden=0
 const html=renderToStaticMarkup(React.createElement(OneShotKey,{value:'PRIVATE-KEY',onHide(){hidden++}}))
 assert.match(html,/PRIVATE-KEY/);assert.match(html,/una sola vez/);assert.doesNotMatch(html,/href=.*PRIVATE|<script/)
 nodes.find(n=>n.type==='button'&&n.props['aria-label']==='Ocultar clave').props.onClick();assert.equal(hidden,1)
})
function formHarness({fail=false,readOnly=false,paused=false,replace=false}={}){
 let index=0,calls=0,confirmations=0,requestSignal,confirmationText=''
 const values=[],effects=new Map(),queued=[],cleanups=[],nodes=[],scope={companyId:'c',branchId:'b',userId:'u',sessionId:'s'}
 const state=initial=>{const key=index++;if(!(key in values))values[key]=typeof initial==='function'?initial():initial;return[values[key],next=>values[key]=typeof next==='function'?next(values[key]):next]}
 const credential={id:'key',name:'Web',status:paused?'PAUSED':'ACTIVE',pausedAt:paused?'2026-10-26T12:00:00Z':null,integrationId:'i',expiresAt:'2026-11-25T12:00:00Z',owner:{id:'u',name:'Ana'},branches:[{id:'b',name:'Principal'}],scopes:['products.read']}
 const {CredentialForm}=loadReportModule('../config/integrations/CredentialForm.tsx',{
  react:{...React,useState:state,useRef:initial=>state(()=>({current:initial}))[0],useEffect:effect=>{const key=index++;if(!effects.has(key)){effects.set(key,true);queued.push(effect)}}},
  'react-router-dom':{Link:({to,children})=>React.createElement('a',{href:to},children)},
  '@/components/ui/button':{Button:props=>React.createElement('button',props,props.children)},
  '@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',timezone:'America/Guatemala'})},
  '../documentTemplates/useTemplateConfirmation':{useTemplateConfirmation:()=>({dialog:null,confirm:async copy=>{confirmations++;confirmationText=copy.description;return true}})},
  './api':{getOptions:async()=>({owners:[{id:'u',name:'Ana'}],branches:[{id:'b',name:'Principal'}],scopes:['products.read'],hasMore:false}),getKey:async()=>replace?credential:null,integrationError:()=> 'Respuesta no disponible',createKey:async(_s,_i,_r,signal)=>{calls++;requestSignal=signal;if(fail)throw Error('offline');return{credential,apiKey:'PRIVATE-ONCE'}}}
 },nodes)
 const render=()=>{index=0;nodes.length=0;return renderToStaticMarkup(React.createElement(CredentialForm,{context:{scope,key:'context',canManage:true,canRead:true,readOnly},replaceId:replace?'key':undefined}))}
 const flush=()=>new Promise(r=>setImmediate(r))
 const mount=async()=>{render();for(const effect of queued.splice(0)){const cleanup=effect();if(cleanup)cleanups.push(cleanup)}await flush();return render()}
 const fill=()=>{nodes.find(n=>n.type==='input'&&n.props.placeholder==='Ej. Tienda web').props.onChange({target:{value:'Web'}});render();nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});render();nodes.filter(n=>n.type==='input'&&n.props.type==='checkbox')[1].props.onChange({target:{checked:true}});render()}
 return{nodes,render,mount,fill,flush,unmount:()=>cleanups.forEach(c=>c()),get calls(){return calls},get confirmations(){return confirmations},get confirmationText(){return confirmationText},get signal(){return requestSignal}}
}
test('paused replacement explains inherited pause before confirmation and after creation',async()=>{
 const f=formHarness({paused:true,replace:true});const initial=await f.mount();assert.match(initial,/reemplazo.*pausad/i)
 f.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await f.flush()
 assert.match(f.confirmationText,/pausad/i);assert.match(f.render(),/Pausada/)
 assert.doesNotMatch(f.render(),/anterior sigue activa|anterior seguirá activa/);f.unmount()
})
test('the real creation form prevents duplicate submission, keeps the secret ephemeral and clears it on request',async()=>{
 const f=formHarness();assert.match(await f.mount(),/Vigencia/);f.fill()
 const submit=f.nodes.find(n=>n.type==='form').props.onSubmit
 submit({preventDefault(){}});submit({preventDefault(){}});await f.flush()
 assert.equal(f.calls,1);assert.equal(f.confirmations,1);assert.match(f.render(),/PRIVATE-ONCE/)
 f.nodes.find(n=>n.props['aria-label']==='Ocultar clave').props.onClick()
 assert.doesNotMatch(f.render(),/PRIVATE-ONCE/);assert.match(f.render(),/No puede recuperarse/)
 f.unmount();assert.equal(f.signal.aborted,true)
})
test('a lost creation response offers review instead of an automatic mutation retry',async()=>{
 const f=formHarness({fail:true});await f.mount();f.fill();f.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await f.flush()
 assert.match(f.render(),/No repitas la creación/);f.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await f.flush();assert.equal(f.calls,1)
 f.unmount()
})
test('consolidated mode cannot create a key even when form submission is invoked directly',async()=>{
 const f=formHarness({readOnly:true});await f.mount();f.nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await f.flush();assert.equal(f.calls,0);assert.equal(f.confirmations,0);f.unmount()
})
test('the library distinguishes loading, empty illustrated and failed states without inventing records',()=>{
 const render=(loading,error='')=>{
  let index=0;const values=[[],0,1,loading,error,0]
  const {IntegrationLibrary}=loadReportModule('../config/pages/IntegrationsPage.tsx',{
   react:{...React,useEffect(){},useState:initial=>[values[index++]??initial,()=>{}]},
   'react-router-dom':{Link:({children,to})=>React.createElement('a',{href:to},children)},
   '../integrations/IntegrationSettingsLayout':{IntegrationSettingsLayout:({children})=>React.createElement('main',null,children)},
   '../integrations/IntegrationUsage':{IntegrationUsage:()=>null},'../integrations/CredentialFilters':{CredentialFilters:()=>null},
   '../integrations/api':{},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',timezone:'America/Guatemala'})}
  })
  return renderToStaticMarkup(React.createElement(IntegrationLibrary,{context:{scope:{},key:'c',companyName:'Empresa',canManage:true,readOnly:false}}))
 }
 assert.match(render(true),/Cargando claves/);const empty=render(false);assert.match(empty,/Crear primera clave/);assert.match(empty,/auna-empty-state-art/)
 const failed=render(false,'No se pudo cargar');assert.match(failed,/No se pudo cargar/);assert.match(failed,/Volver a intentar/);assert.doesNotMatch(failed,/Crear primera clave/)
})

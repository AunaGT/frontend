const test=require('node:test'),assert=require('node:assert/strict')
const {integrationView,context}=require('./helpers/integrationViewHarness.cjs')
function detail({status='ACTIVE',fail=false,readOnly=false,confirm:confirmation}={}){
 let calls=0,signal,release;const pending=new Promise(r=>release=r)
 const row={id:'key',name:'Web',status,publicId:'public',integrationId:'i',scopes:['products.read'],branches:[{id:'b',name:'Principal'}],owner:{id:'u',name:'Ana'},expiresAt:null,pausedAt:status==='PAUSED'?'2026-10-26':null,customerPolicy:'EXISTING_ONLY',lastUsedAt:null}
 const mutate=async(_scope,_id,s)=>{calls++;signal=s;if(fail)throw Error('lost');await pending;return row}
 const f=integrationView('../config/pages/IntegrationDetailPage.tsx','IntegrationDetail',{context:{...context,readOnly},id:'key'},{'../integrations/IntegrationSettingsLayout':{IntegrationSettingsLayout:({children})=>children},'../integrations/IntegrationUsage':{IntegrationUsage:()=>null},'../documentTemplates/useTemplateConfirmation':{useTemplateConfirmation:()=>({dialog:null,confirm:confirmation||(async()=>true)})},'../integrations/api':{getKey:async()=>row,getHistory:async()=>({items:[],total:0}),pauseKey:mutate,resumeKey:mutate,revokeKey:mutate,integrationError:()=> 'Respuesta no disponible'}})
 return{...f,async mount(){f.render();await f.flush();return f.render()},get calls(){return calls},get signal(){return signal},release}
}
test('pause confirms once, prevents duplicate submission, and aborts when leaving',async()=>{
 const f=detail();await f.mount()
 const click=f.nodes.find(n=>n.props.children==='Pausar').props.onClick
 click();click();await f.flush();assert.equal(f.calls,1)
 f.unmount();assert.equal(f.signal.aborted,true);f.release();await f.flush()
})
test('uncertain mutation response cannot be retried before reloading metadata',async()=>{
 const f=detail({fail:true});await f.mount()
 const click=f.nodes.find(n=>n.props.children==='Pausar').props.onClick
 click();await f.flush();assert.match(f.render(),/No repitas/)
 f.nodes.find(n=>n.props.children==='Pausar').props.onClick();await f.flush();assert.equal(f.calls,1)
 f.unmount()
})
test('expired and revoked credentials never offer resume and readonly cannot mutate',async()=>{
 for(const status of ['EXPIRED','REVOKED']){const f=detail({status});const html=await f.mount();assert.doesNotMatch(html,/>Reanudar</);assert.doesNotMatch(html,/>Pausar</);f.unmount()}
 const f=detail({readOnly:true});await f.mount();assert.equal(f.nodes.some(n=>n.props.children==='Pausar'),false);assert.equal(f.calls,0);f.unmount()
 const paused=detail({status:'PAUSED'});assert.match(await paused.mount(),/Reanudar/);paused.unmount()
})
test('leaving while a confirmation is pending never starts a new action',async()=>{
 let answer;const f=detail({confirm:()=>new Promise(r=>answer=r)});await f.mount()
 f.nodes.find(n=>n.props.children==='Pausar').props.onClick();f.unmount();answer(true);await f.flush();assert.equal(f.calls,0)
})

const test=require('node:test'),assert=require('node:assert/strict')
const {hookHarness}=require('./helpers/reportHookHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('dirty template navigation waits for system confirmation; pending saves block tenant and anchor navigation',async()=>{
  const prior={window:global.window,document:global.document},h=hookHarness(),listeners={},activity={current:{dirty:true,pending:false}}
  let registered,choose,confirms=0,message='',left=0
  const confirm=()=>{confirms++;return new Promise(resolve=>choose=resolve)}
  global.window={addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{},confirm:()=>assert.fail('No native confirmation')}
  global.document={addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{}}
  try {
    const {useTemplateLeaveGuard}=loadReportModule('../config/documentTemplates/useTemplateLeaveGuard.ts',{react:{...h.hooks,useContext:()=>null}})
    h.render(()=>useTemplateLeaveGuard(activity,fn=>{registered=fn;return()=>{}},value=>message=value,confirm))
    assert.equal(registered(()=>left++),false);assert.equal(confirms,1);assert.equal(left,0)
    choose(false);await Promise.resolve();assert.equal(left,0)
    let prevented=false
    listeners.click({button:0,target:{closest:()=>({target:'',getAttribute:()=>'/ventas',hasAttribute:()=>false})},preventDefault:()=>prevented=true,stopImmediatePropagation:()=>{}})
    assert.equal(prevented,true);assert.equal(confirms,2)
    choose(false);await Promise.resolve()
    assert.equal(registered(()=>left++),false);choose(true);await Promise.resolve();assert.equal(left,1)
    let unloadPrompts=0
    const unload=()=>listeners.beforeunload({preventDefault:()=>unloadPrompts++})
    unload();assert.equal(unloadPrompts,0,'accepted tenant navigation must not ask again through native beforeunload')
    unload();assert.equal(unloadPrompts,1,'approval applies only to the corresponding unload')
    assert.equal(registered(()=>left++),false);choose(true);await Promise.resolve()
    listeners.pointerdown();unload();assert.equal(unloadPrompts,2,'new user activity restores protection if the accepted navigation did not unload')
    activity.current={dirty:false,pending:true};assert.equal(registered(()=>left++),false);assert.match(message,/Espera/);assert.equal(left,2)
  }finally{h.unmount();Object.assign(global,prior)}
})
test('XML guard protects router/history navigation and resumes the selected route only after confirmation',async()=>{
  const prior={window:global.window,document:global.document},h=hookHarness(),listeners=new Map(),routed=[],activity={current:{dirty:true,pending:false}}
  let index=2,choose,confirms=0,message=''
  const history={get state(){return {idx:index}},go(delta){index+=delta;let stopped=false;const event={stopImmediatePropagation(){stopped=true}};for(const fn of listeners.get('popstate')||[])fn(event);if(!stopped)routed.push(index)}}
  const navigator={push(to){index++;routed.push(to)},replace(to){routed.push(to)},go:delta=>history.go(delta)}
  global.window={history,confirm:()=>assert.fail('No native confirmation'),addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn)}
  global.document={addEventListener(){},removeEventListener(){}}
  try{
    const {useTemplateLeaveGuard}=loadReportModule('../config/documentTemplates/useTemplateLeaveGuard.ts',{react:{...h.hooks,useContext:()=>({navigator})}})
    const canLeave=h.render(()=>useTemplateLeaveGuard(activity,()=>()=>{},v=>message=v,()=>{confirms++;return new Promise(resolve=>choose=resolve)}))
    navigator.push('/otra');assert.deepEqual(routed,[]);assert.equal(confirms,1)
    choose(false);await Promise.resolve()
    history.go(-1);assert.equal(index,2);assert.deepEqual(routed,[]);assert.equal(confirms,2)
    choose(false);await Promise.resolve()
    const go=()=>navigator.push('/permitida');if(canLeave(go))go();assert.deepEqual(routed,[]);choose(true);await Promise.resolve();assert.deepEqual(routed,['/permitida']);assert.equal(confirms,3)
    activity.current.pending=true;navigator.go(-1);assert.equal(index,3);assert.match(message,/Espera/)
    activity.current={dirty:false,pending:false};navigator.go(-1);assert.equal(index,2)
  }finally{h.unmount();Object.assign(global,prior)}
})
test('catalog sidebar, create and tabs reuse the active appearance guard even during its save',()=>{
  const h=hookHarness(),nodes=[],paths=[],scope={companyId:'A',branchId:'B',userId:'U',sessionId:'S'}
  const context={scope,key:'A',canRead:true,canManage:true,canPublish:true,companyName:'QA',registerGuard:()=>()=>{}}
  const Page=loadReportModule('../config/pages/DocumentTemplatesPage.tsx',{react:{...h.hooks,useContext:()=>null},'react-router-dom':{useNavigate:()=>to=>paths.push(to)},'@/components/layout/PageNavigation':{usePageTrail(){}},'../documentTemplates/TemplateAppearance':{TemplateAppearance:function TemplateAppearance(){}},'../documentTemplates/useTemplateScope':{useTemplateScope:()=>context},'../documentTemplates/api':{listTemplates:async()=>({rows:[],total:0}),templateSchema:async()=>({bases:[]})}},nodes).default
  const element=Page(),render=()=>{nodes.length=0;return h.render(()=>element.type(element.props))}
  try{
    render();nodes.find(n=>n.props.children==='Apariencia de facturación').props.onClick();render()
    const appearance=nodes.find(n=>n.type.name==='TemplateAppearance');assert.ok(appearance)
    let checks=0;const cleanup=appearance.props.registerGuard(()=>{checks++;return false})
    assert.equal(nodes.find(n=>n.type.name==='TemplateSettingsLayout').props.canLeave(),false)
    nodes.find(n=>n.props.children==='Crear diseño').props.onClick();assert.deepEqual(paths,[])
    nodes.find(n=>n.props.children==='Mis plantillas').props.onClick();render();assert.ok(nodes.find(n=>n.type.name==='TemplateAppearance'));assert.equal(checks,3)
    cleanup()
  }finally{h.unmount()}
})

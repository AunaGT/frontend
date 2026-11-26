const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {hookHarness}=require('./helpers/reportHookHarness.cjs')

test('background lookup errors stay accessible without stealing input focus; submitted errors still focus',()=>{
  const h=hookHarness(),nodes=[];let focused=0
  h.hooks.useRef=()=>({current:{focus:()=>focused++}})
  const {FormFeedback}=loadReportModule('../appointments/components/FormFeedback.tsx',{react:h.hooks},nodes)
  const render=props=>{nodes.length=0;return h.render(()=>FormFeedback(props))}
  try{
    render({error:'No se pudo revisar el importe',focusOnError:false})
    assert.equal(focused,0,'an automatic lookup must not take focus')
    assert.equal(nodes.find(n=>n.type==='div').props.role,'alert')
    render({error:'Revisa la cantidad',fields:{quantity:'Cantidad inválida'}})
    assert.equal(focused,1,'errors from an explicit submission still receive focus')
    assert.equal(nodes.find(n=>n.type==='a').props.href,'#agenda-quantity')
  }finally{h.unmount()}
})

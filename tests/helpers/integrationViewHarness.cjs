const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {hookHarness}=require('./reportHookHarness.cjs'),{loadReportModule}=require('./loadReportModule.cjs')
const scope={companyId:'c',branchId:'b',userId:'u',sessionId:'s'}
const context={scope,key:'context',companyName:'Empresa',canManage:true,canRead:true,readOnly:false}
function integrationView(relative,name,props={},mocks={}){
 const h=hookHarness(),nodes=[]
 const component=loadReportModule(relative,{react:h.hooks,'react-router-dom':{Link:({to,children})=>React.createElement('a',{href:to},children)},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',timezone:'America/Guatemala'})},...mocks},nodes)[name]
 return{nodes,render(nextProps=props){nodes.length=0;return h.render(()=>renderToStaticMarkup(React.createElement(component,nextProps)))},flush:()=>new Promise(resolve=>setImmediate(resolve)),unmount:h.unmount}
}
module.exports={integrationView,scope,context}

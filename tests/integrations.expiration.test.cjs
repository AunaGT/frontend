const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('unlimited validity is explicit and date labels never show epoch for null',()=>{
 const {initialCredentialInput,validateCredentialInput,validityLabel}=loadReportModule('../config/integrations/model.ts')
 const input={...initialCredentialInput('u'),name:'Web',scopes:['products.read'],branchIds:['b'],days:null}
 assert.equal(validateCredentialInput(input),'');assert.equal(validityLabel(null),'Sin vencimiento');assert.equal(validityLabel(30),'30 días')
 const {useIntegrationDate}=loadReportModule('../config/integrations/useIntegrationDate.ts',{'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT',timezone:'America/Guatemala'})}})
 assert.equal(useIntegrationDate()(null),'Sin vencimiento')
})
test('expiry selector uses shared Auna controls and offers unlimited without replacing the whole form',()=>{
 const nodes=[],changes=[],{CredentialValidity}=loadReportModule('../config/integrations/CredentialValidity.tsx',{},nodes)
 const html=renderToStaticMarkup(React.createElement(CredentialValidity,{days:90,disabled:false,onChange:v=>changes.push(v)}))
 assert.match(html,/Vigencia/);assert.match(html,/auna-control/);assert.doesNotMatch(html,/type="number"/)
 const select=nodes.find(n=>typeof n.props.onValueChange==='function')
 select.props.onValueChange('never');assert.equal(changes[0],null)
 select.props.onValueChange('30');assert.equal(changes[1],30)
 assert.ok(nodes.some(n=>n.props.value==='custom'));assert.ok(nodes.some(n=>n.props.value==='365'))
})

const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
test('client creation stays opt-in and requires a draft scope, creation scope and payment term',()=>{
 const {initialCredentialInput,validateCredentialInput,withScopes,withCustomerPolicy}=loadReportModule('../config/integrations/model.ts')
 const initial=initialCredentialInput('u');assert.equal(initial.customerPolicy,'EXISTING_ONLY');assert.equal(initial.customerPaymentTermId,null);assert.deepEqual(initial.scopes,[])
 const draft={...initial,name:'Web',branchIds:['b'],scopes:['quotes.create_draft']}
 assert.equal(validateCredentialInput(draft),'')
 const enabled=withCustomerPolicy(draft,'CREATE_IF_MISSING');assert.equal(enabled.customerPolicy,'CREATE_IF_MISSING');assert.ok(enabled.scopes.includes('customers.create'));assert.ok(validateCredentialInput(enabled))
 assert.equal(validateCredentialInput({...enabled,customerPaymentTermId:1}),'')
 const disabled=withCustomerPolicy({...enabled,customerPaymentTermId:1},'EXISTING_ONLY');assert.equal(disabled.customerPaymentTermId,null);assert.ok(!disabled.scopes.includes('customers.create'))
 const withoutDraft=withScopes({...enabled,customerPaymentTermId:1},['products.read','customers.create']);assert.equal(withoutDraft.customerPolicy,'EXISTING_ONLY');assert.deepEqual(withoutDraft.scopes,['products.read'])
})
test('real policy controls show consequences and replacement cannot change its payment term',()=>{
 const nodes=[],changes=[],{CustomerCreationPolicy}=loadReportModule('../config/integrations/CustomerCreationPolicy.tsx',{'./api':{}},nodes)
 const input={name:'Web',ownerId:'u',branchIds:['b'],days:90,scopes:['quotes.create_draft','customers.create'],customerPolicy:'CREATE_IF_MISSING',customerPaymentTermId:1}
 const html=renderToStaticMarkup(React.createElement(CustomerCreationPolicy,{scope:{},input,onChange:v=>changes.push(v),onTermName(){},termName:'Contado',disabled:false,canCreate:true,replace:true}))
 assert.match(html,/No podrá modificar clientes existentes/);assert.match(html,/customers.create/);assert.match(html,/Contado/)
 assert.match(html,/auna-control/)
 assert.equal(nodes.find(n=>n.props.id==='integration-payment-term').props.disabled,true)
 nodes.find(n=>n.type==='input'&&n.props.type==='radio').props.onChange()
 assert.equal(changes[0].customerPolicy,'EXISTING_ONLY');assert.equal(changes[0].customerPaymentTermId,null);assert.deepEqual(changes[0].scopes,['quotes.create_draft'])
 nodes.length=0
 renderToStaticMarkup(React.createElement(CustomerCreationPolicy,{scope:{},input:changes[0],onChange:v=>changes.push(v),onTermName(){},termName:'',inheritedTerm:{id:1,name:'Contado'},disabled:false,canCreate:true,replace:true}))
 nodes.filter(n=>n.type==='input'&&n.props.type==='radio')[1].props.onChange()
 assert.equal(changes[1].customerPaymentTermId,1)
})
test('payment term reads reject stale tenant responses without retrying a mutation',async()=>{
 let company='a',options
 const {getCustomerPaymentTerms}=loadReportModule('../config/integrations/api.ts',{'@/services/api':{getActiveCompanyId:()=>company,getActiveBranchId:()=> 'b',apiFetch:async(_p,o)=>{options=o;company='other';return{items:[{id:1,name:'secret'}],page:1,hasMore:false}}},'@/services/authSession':{authSessionIdentity:()=> 's',authSessionMatches:()=>true}})
 await assert.rejects(()=>getCustomerPaymentTerms({companyId:'a',branchId:'b',userId:'u',sessionId:'s'},{page:1,q:''}),{name:'AbortError'});assert.equal(options.retryUnauthorized,false)
})

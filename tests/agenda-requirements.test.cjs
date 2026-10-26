const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const requirement={id:'req-1',name:'Equipo de atención',kind:'RESOURCE',quantity:2,optionIds:['r1','r2']}
const directory={branches:[{id:'b',name:'Principal'}],providers:[],resources:[{id:'r1',name:'Barra uno',active:true,branchId:'b',portable:true,type:'EQUIPMENT'},{id:'r2',name:'Barra dos',active:true,branchId:'b',portable:true,type:'EQUIPMENT'}]}
test('requirements use compact system controls in the service page and preserve explicit changes',()=>{
 const nodes=[],changes=[],{AssignmentRequirementsFields}=loadReportModule('../appointments/components/AssignmentRequirementsFields.tsx',{},nodes)
 const html=renderToStaticMarkup(React.createElement(AssignmentRequirementsFields,{value:[requirement],onChange:v=>changes.push(v),directory,providerIds:[],resourceIds:['r1','r2'],disabled:false,errors:{}}))
 assert.match(html,/Requisitos específicos/);assert.match(html,/Equipo de atención/);assert.doesNotMatch(html,/role="dialog"/)
 const quantity=nodes.find(n=>n.props.id==='requirement-req-1-quantity');quantity.props.onChange({target:{value:'1'}})
 assert.equal(changes.at(-1)[0].quantity,1);assert.deepEqual(changes.at(-1)[0].optionIds,['r1','r2'])
})
test('read-only requirements never expose an enabled edit action',()=>{
 const nodes=[],{AssignmentRequirementsFields}=loadReportModule('../appointments/components/AssignmentRequirementsFields.tsx',{},nodes)
 renderToStaticMarkup(React.createElement(AssignmentRequirementsFields,{value:[requirement],onChange(){throw Error('unexpected write')},directory,providerIds:[],resourceIds:['r1','r2'],disabled:true,errors:{}}))
 const buttons=nodes.filter(n=>n.type?.displayName==='Button')
 assert.ok(buttons.length);assert.ok(buttons.every(n=>n.props.disabled))
})
test('runtime status shows a missing second equipment and does not count an archived option',()=>{
 const {AssignmentRequirementsStatus}=loadReportModule('../appointments/components/AssignmentRequirementsFields.tsx')
 const render=(ids,d=directory)=>renderToStaticMarkup(React.createElement(AssignmentRequirementsStatus,{requirements:[requirement],providerIds:[],resourceIds:ids,directory:d}))
 assert.match(render(['r1']),/1 de 2/);assert.match(render(['r1','r2']),/2 de 2/)
 assert.match(render(['r1','r2'],{...directory,resources:[directory.resources[0],{...directory.resources[1],active:false}]}),/1 de 2/)
 assert.equal(renderToStaticMarkup(React.createElement(AssignmentRequirementsStatus,{requirements:[],providerIds:[],resourceIds:[],directory})), '')
})
test('invalidated options are not silently removed from a configuration draft',()=>{
 const nodes=[],changes=[],{AssignmentRequirementsFields}=loadReportModule('../appointments/components/AssignmentRequirementsFields.tsx',{},nodes)
 const html=renderToStaticMarkup(React.createElement(AssignmentRequirementsFields,{value:[requirement],onChange:v=>changes.push(v),directory,providerIds:[],resourceIds:['r1'],disabled:false,errors:{}}))
 assert.match(html,/no disponibles|no habilitadas/);assert.deepEqual(changes,[])
 nodes.find(n=>n.props.children==='Quitar opciones no habilitadas').props.onClick()
 assert.deepEqual(changes[0][0].optionIds,['r1'])
})
test('service configuration integrates requirements while preserving the old optional profile',()=>{
 const {ServiceScheduleFields,defaultProfile}=loadReportModule('../appointments/components/ServiceScheduleFields.tsx')
 const html=renderToStaticMarkup(React.createElement(ServiceScheduleFields,{value:{...defaultProfile,enabled:true,assignmentRequirements:[requirement],resourceIds:['r1','r2']},onChange(){},disabled:false,directory,errors:{assignmentRequirements:'Falta equipo habilitado'}}))
 assert.match(html,/Requisitos específicos/);assert.match(html,/Falta equipo habilitado/)
})
test('public service facts and text expose requirements without internal option data',()=>{
 const {serviceConditionText}=loadReportModule('../../services/serviceConditions.ts')
 const snapshot={version:1,schedulingStyle:'WORK',durationPolicy:'FIXED',durationMinutes:60,allowedVenueKinds:['EVENT_VENUE'],publicInstructions:'Acceso principal',assignmentRequirements:[{...requirement,optionIds:['PRIVATE']}]}
 assert.match(serviceConditionText(snapshot),/Equipo de atención/);assert.match(serviceConditionText(snapshot),/2 equipos/)
 const {publicCommercialPackageGroups}=loadReportModule('../../components/shared/CommercialPackageSummary.tsx')
 const groups=publicCommercialPackageGroups([{schemaVersion:1,groupId:'g',name:'Paquete',variantName:'Evento',currency:'GTQ',state:'COMPLETE',estimatedAmount:'10',amount:'10',netAmount:'10',issues:[],components:[{key:'g:c',itemKind:'SERVICE',serviceConditions:snapshot}]}])
 assert.equal(groups[0].components[0].serviceConditions.assignmentRequirements[0].quantity,2)
 assert.doesNotMatch(JSON.stringify(groups),/PRIVATE|optionIds|req-1/)
})

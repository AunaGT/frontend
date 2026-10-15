const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
const catalog=[['hr.employees.view','Ver empleados'],['hr.documents.view','Ver documentos de empleados'],['hr.attendance.view','Ver asistencia'],['hr.documents.archive','Archivar documentos de empleados'],['contacts.clients.view','Ver clientes'],['contacts.suppliers.view','Ver proveedores']].map(([code,name],i)=>({id:i+1,code,name}))
test('every sibling permission appears once with Spanish module labels',()=>{
 const nodes=[],{PermissionMatrix}=loadReportModule('../users/PermissionMatrix.tsx',{},nodes)
 const html=renderToStaticMarkup(React.createElement(PermissionMatrix,{catalog,selected:[],onChange(){}}))
 const labels=[...html.matchAll(/aria-label="([^"]+)"/g)].map(m=>m[1])
 assert.deepEqual(labels.sort(),['Archivar documentos de empleados','Ver asistencia','Ver clientes','Ver documentos de empleados','Ver empleados','Ver proveedores'].sort())
 assert.match(html,/Recursos humanos/);assert.doesNotMatch(html,/>Hr</)
})
test('dependencies terminate through cycles and disabled switches cannot mutate',()=>{
 const nodes=[],{PermissionMatrix}=loadReportModule('../users/PermissionMatrix.tsx',{},nodes),p=[{id:1,code:'hr.employees.view',name:'Ver empleados',implies:['hr.documents.view']},{id:2,code:'hr.documents.view',name:'Ver documentos',implies:['hr.employees.view']}];let selected
 PermissionMatrix({catalog:p,selected:[],onChange:v=>selected=v});nodes.find(n=>n.props?.['aria-label']==='Ver empleados').props.onCheckedChange();assert.deepEqual(selected,['hr.employees.view','hr.documents.view'])
 nodes.length=0;selected=null;PermissionMatrix({catalog:p,selected:[],disabled:true,onChange:v=>selected=v});nodes.find(n=>n.props?.['aria-label']==='Ver empleados').props.onCheckedChange();assert.equal(selected,null)
})

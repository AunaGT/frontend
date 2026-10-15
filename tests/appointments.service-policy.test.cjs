const test=require('node:test'),assert=require('node:assert/strict')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('configurar trabajo completo no confunde asistentes con cupos',()=>{
  const {ServiceScheduleFields,defaultProfile}=loadReportModule('../appointments/components/ServiceScheduleFields.tsx')
  const html=renderToStaticMarkup(React.createElement(ServiceScheduleFields,{value:{...defaultProfile,enabled:true,schedulingStyle:'WORK',durationPolicy:'EDITABLE'},
    onChange(){},disabled:false,directory:{branches:[],providers:[],resources:[]},errors:{}}))
  assert.match(html,/Trabajo o evento completo/);assert.match(html,/Editable al agendar/)
  assert.doesNotMatch(html,/1 persona/)
  assert.doesNotMatch(html,/Confirmación|Recepción confirma/)
})

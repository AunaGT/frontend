// Isolated interactive preview of real controls; no application session or API calls.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild'),root=path.resolve(__dirname,'../..')
const requirements=[{id:'qa-team',name:'Equipo de atención en el lugar del evento',kind:'PROVIDER',quantity:2,optionIds:['p1','p2']},{id:'qa-bar',name:'Barra transportable',kind:'RESOURCE',quantity:1,optionIds:['r1','r2']}]
const directory={branches:[{id:'b',name:'Sucursal responsable'}],providers:[{id:'p1',name:'Profesional de ejemplo uno',active:true},{id:'p2',name:'Profesional de ejemplo dos',active:true}],resources:[{id:'r1',name:'Barra transportable uno',active:true},{id:'r2',name:'Barra transportable dos',active:true}]}
const css=fs.readdirSync(path.join(root,'dist/assets')).filter(name=>name.endsWith('.css')).map(name=>fs.readFileSync(path.join(root,'dist/assets',name),'utf8')).join('\n')
const output=path.join(root,'output/playwright');fs.mkdirSync(output,{recursive:true})
async function run(){
 const {outputFiles}=await esbuild.build({stdin:{contents:`import React,{useState} from 'react';import{createRoot}from'react-dom/client';
 import{ServiceScheduleFields,defaultProfile,AssignmentChoices}from'@/modules/appointments/components/ServiceScheduleFields';
 import{AssignmentRequirementsStatus}from'@/modules/appointments/components/AssignmentRequirementsFields';
 import{Button}from'@/components/ui/button';const directory=${JSON.stringify(directory)};
 function Preview(){const[value,set]=useState({...defaultProfile,enabled:true,schedulingStyle:'WORK',branchIds:['b'],providerIds:['p1','p2'],resourceIds:['r1','r2'],assignmentRequirements:${JSON.stringify(requirements)},allowedVenueKinds:['EVENT_VENUE']});const[disabled,setDisabled]=useState(false),[providers,setProviders]=useState(['p1']);
 return <main className="agenda-page"><div className="max-w-4xl space-y-5"><h1 className="text-xl font-semibold">Configurar servicio · Datos de ejemplo</h1><Button variant="outline" onClick={()=>setDisabled(!disabled)}>Alternar solo lectura</Button><section className="agenda-panel"><ServiceScheduleFields value={value} onChange={set} disabled={disabled} directory={directory} errors={{}}/></section><h2>Al programar el servicio</h2><AssignmentChoices label="Personal de esta programación" items={directory.providers} value={providers} onChange={setProviders}/><AssignmentRequirementsStatus requirements={value.assignmentRequirements} providerIds={providers} resourceIds={['r1']} directory={directory}/></div></main>}
 createRoot(document.getElementById('preview')).render(<Preview/>);`,resolveDir:root,sourcefile:'requirements-preview.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"'}})
 fs.writeFileSync(path.join(output,'requirements-preview.js'),outputFiles[0].text)
 fs.writeFileSync(path.join(output,'requirements-preview.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><aside aria-label="Navegación de Auna" style="position:fixed;width:56px;height:100vh;border-right:1px solid gray">Auna</aside><div id="preview" style="margin-left:56px"></div><script src="./requirements-preview.js"></script></body></html>`)
 console.log(path.join(output,'requirements-preview.html'))
}
run().catch(e=>{console.error(e);process.exitCode=1})

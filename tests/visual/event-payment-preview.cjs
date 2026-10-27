// Isolated hydrated Auna components. Synthetic agreement only; no session, APIs or writes.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild'),root=path.resolve(__dirname,'../..')
async function run(){
 const output=path.join(root,'output/playwright');fs.mkdirSync(output,{recursive:true})
 const css=fs.readdirSync(path.join(root,'dist/assets')).filter(n=>/^(index-|appointments-).+\.css$/.test(n)).map(n=>fs.readFileSync(path.join(root,'dist/assets',n),'utf8')).join('\n')
 const {outputFiles}=await esbuild.build({stdin:{resolveDir:root,sourcefile:'event-payment-preview.tsx',loader:'tsx',contents:`
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{EventPaymentTermsFields}from'@/components/shared/EventPaymentTermsFields';
 import{EngagementPaymentStatus}from'@/modules/appointments/components/EngagementPaymentStatus';
 import{PaymentReferenceReview}from'@/modules/appointments/components/PaymentReferenceReview';
 import{eventPaymentDraft,eventPaymentDraftErrors,eventPaymentPayload}from'@/modules/appointments/eventPaymentDraft';
 import{Button}from'@/components/ui/button';import'@/modules/appointments/appointments.css';
 const review={acknowledgedPaymentReviewHash:'a'.repeat(64),paymentReferenceReview:JSON.stringify([{before:{startsAt:'2027-01-10T16:00:00Z',timezone:'America/Guatemala'},after:{startsAt:'2027-01-09T16:00:00Z',timezone:'America/Guatemala'},dueBefore:'2027-01-07T16:00:00Z',dueAfter:'2027-01-06T16:00:00Z'}])};
 function Preview(){const[value,setValue]=useState(eventPaymentDraft(null,'America/Guatemala')),[errors,setErrors]=useState({}),[result,setResult]=useState('Sin guardar'),[reviewed,setReviewed]=useState(false);
 const state={enabled:true,confirmation:'PENDING_DEPOSIT',payment:'PARTIAL',depositMissing:'50.00',remaining:'250.00',dueAt:'2027-01-07T16:00:00Z',reference:{startsAt:'2027-01-10T16:00:00Z',timezone:'America/Guatemala'},canStart:false,canComplete:false,reasons:[]};
 return <main className="agenda-page"><header><h1 className="text-xl font-semibold">Acuerdo de servicio · ejemplo</h1><p className="text-xs text-muted-foreground">Datos ficticios · no se envía nada a Auna.</p></header><div className="agenda-editor-grid"><form className="agenda-panel space-y-4" onSubmit={e=>{e.preventDefault();const next=eventPaymentDraftErrors(value);setErrors(next);if(Object.keys(next).length){document.querySelector('[data-event-payment-field="'+Object.keys(next)[0]+'"]').focus();return}setResult('Acuerdo revisado')}} noValidate><EventPaymentTermsFields value={value} total="400.00" currencyCode="GTQ" available onChange={v=>{setValue(v);setErrors({})}} errors={errors}/><Button type="submit">Revisar acuerdo de ejemplo</Button><output aria-live="polite">{result}</output></form><aside className="space-y-4"><EngagementPaymentStatus state={state} currencyCode="GTQ" onCollect={()=>setResult('Abrir cobros, sin marcar pagado')}/><PaymentReferenceReview fields={reviewed?{}:review} onConfirm={()=>setReviewed(true)}/>{reviewed&&<p role="status">Fechas aceptadas en el ejemplo</p>}</aside></div></main>}
 createRoot(document.getElementById('preview')).render(<Preview/>);`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"'}})
 fs.writeFileSync(path.join(output,'event-payment-preview.js'),outputFiles[0].text)
 fs.writeFileSync(path.join(output,'event-payment-preview.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><aside aria-label="Navegación de Auna" style="position:fixed;width:56px;height:100vh;border-right:1px solid gray">Auna</aside><div id="preview" style="margin-left:56px"></div><script src="./event-payment-preview.js"></script></body></html>`)
 console.log(path.join(output,'event-payment-preview.html'))
}
run().catch(e=>{console.error(e);process.exitCode=1})

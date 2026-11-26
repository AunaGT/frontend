// Real Auna page, isolated synthetic API; never connects to the active backend.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/playwright')
async function build(){
 const {outputFiles}=await esbuild.build({stdin:{resolveDir:root,sourcefile:'cash-shared-preview.tsx',loader:'tsx',contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Page from '@/modules/cash-closure/CashMyTurnPage';
 const params=new URLSearchParams(location.search),mode=params.get('mode')||'participant';document.documentElement.classList.toggle('dark',params.has('dark'));
 const owner=mode==='owner',invited=mode==='invited';
 const turn={id:'t1',registerId:'r1',registerName:'Mostrador principal',registerCode:'CAJA-1',responsibleName:'Ana López',operationMode:'SHARED',registerType:'PHYSICAL',role:owner?'RESPONSIBLE':invited?'INVITED':'PARTICIPANT',participants:[{user_id:'u1',name:'Ana López'},{user_id:'u2',name:'Luis Pérez'}],openedAt:'2026-11-19T14:00:00Z',closedAt:null,timeZone:'America/Guatemala',businessDate:'2026-11-19',operationCount:owner?12:3,state:'OPERATING',closureId:null,closureStatus:null,needsCloseReason:false,can:{join:invited,close:owner,count:false,handover:false,movement:!invited}};
 const data={available:true,current:mode==='empty'?[]:[turn],pending:mode==='empty'?[]:[{...turn,id:'t0',registerName:'Mostrador principal · turno anterior',state:'RECOUNT',closedAt:'2026-11-18T22:00:00Z',role:'RESPONSIBLE',operationCount:18,can:{join:false,close:false,count:true,handover:true,movement:false}}]};
 window.__qaWrites=0;window.fetch=async(url,options={})=>{if(!String(url).startsWith('https://cash-shared.invalid/'))throw Error('API outside isolated QA');if(options.method==='POST'){window.__qaWrites++;if(String(url).endsWith('/join')){turn.role='PARTICIPANT';turn.can={...turn.can,join:false,movement:true}}if(String(url).endsWith('/close')){data.current=[];data.pending.unshift({...turn,state:'PENDING_COUNT',can:{count:true,handover:true}})}return Response.json({ok:true})}return Response.json(data)};
 createRoot(document.getElementById('preview')).render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Page/></QueryClientProvider></MemoryRouter>);
 `},plugins:[{name:'cash-shared-isolation',setup(b){
 b.onLoad({filter:/\/services\/api\.ts$/},()=>({contents:"export const getApiBaseUrl=()=> 'https://cash-shared.invalid';export const getAuthToken=()=>null;"}));
 b.onLoad({filter:/\/context\/useTenant\.ts$/},()=>({contents:"export const useTenant=()=>({company:{id:'c'},branch:{id:'b',name:'Principal'}});"}));
 b.onLoad({filter:/\/hooks\/useAuthPermissions\.ts$/},()=>({contents:"export const useAuthPermissions=()=>({user:{id:'u'},hasPermission:()=>true});"}));
 b.onLoad({filter:/\/components\/layout\/PageNavigation\.tsx$/},()=>({contents:"export const usePageTrail=()=>{};"}));
 }}],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"'}})
 fs.mkdirSync(out,{recursive:true})
 fs.cpSync(path.join(root,'public/illustrations'),path.join(out,'illustrations'),{recursive:true})
 const css=fs.readdirSync(path.join(root,'dist/assets')).filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync(path.join(root,'dist/assets',n),'utf8')).join('\n')
 fs.writeFileSync(path.join(out,'cash-shared-preview.js'),outputFiles[0].text)
 fs.writeFileSync(path.join(out,'cash-shared-preview.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><aside style="position:fixed;inset:0 auto 0 0;width:48px;border-right:1px solid hsl(var(--border));text-align:center;padding-top:16px">A</aside><div style="margin-left:48px"><header class="border-b px-4 py-3 text-sm">Cajas · Ejemplo sin conexión</header><div id="preview"></div></div><script src="cash-shared-preview.js"></script></body></html>`)
 console.log('Shared turns real-page preview generated with isolated data')
}
build().catch(e=>{console.error(e);process.exitCode=1})

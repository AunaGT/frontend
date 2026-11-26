// Real page and components, isolated synthetic API. This fixture never contacts Auna.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/playwright')
async function build(){
  const {outputFiles}=await esbuild.build({stdin:{resolveDir:root,sourcefile:'cash-daily-preview.tsx',loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Page from '@/modules/cash-closure/CashDailyPage';
    const params=new URLSearchParams(location.search),mode=params.get('mode')||'finalized';document.documentElement.classList.toggle('dark',params.has('dark'));
    const bridge={initial:'140.00',declaredInitial:'100.00',inheritedInitial:'40.00',externalIn:'105.00',externalOut:'10.00',openingDifference:'0.00',acceptedDifference:'-1.00',internal:{inheritedWithinDay:'60.00',openingTransfersIn:'15.00',sessionsIn:'20.00',sessionsOut:'20.00',delivered:'164.00',net:'-149.00'},retainedFinal:'0.00',undeliveredFinal:'85.00',final:'85.00',calculatedFinal:'85.00',difference:'0.00',balanced:true,sources:[]};
    const turn={id:'t1',register_name:'Mostrador principal',register_type:'PHYSICAL',responsible_name:'Ana López',opened_at:'2026-11-19T14:00:00Z',closed_at:'2026-11-19T22:00:00Z',state:'FINALIZED',closure_id:'c1',closure_number:42,review_result:'CLEAN',difference:'0.00'};
    const data={status:mode==='provisional'?'PROVISIONAL':'FINALIZED',contentKey:'a'.repeat(64),canFinalize:true,finalizedBy:'Marta Pérez',finalizedAt:'2026-11-20T01:00:00Z',snapshot:{version:2,businessDate:'2026-11-19',turns:[turn,{...turn,id:'t2',register_name:'Barra de atención y servicios',responsible_name:'Luis Pérez',difference:'-1.00'}],blockers:[],cash:{bridge,opening:'140.00',received:'105.00',fundIn:'0.00',custodyIn:'20.00',paidOut:'10.00',sentToCustody:'20.00',delivered:'164.00',retained:'0.00',acceptedDifference:'-1.00',inTransit:{count:1,amount:'60.00'}},digital:{byMethod:[{name:'Tarjeta',amount:'75.00'}],toSettle:'75.00'},entries:['A-000042'],legacyNotice:null},current:{asOf:'2026-11-20T19:30:00Z',pendingNotices:{count:2,amount:'999.00',oldest:'2026-11-19'},toSettle:'0.00',settlementReferences:[{id:'s1',reference:'VN-801',deposited_on:'2026-11-20'}],depositsByRealDate:{date:'2026-11-19',count:1,net:'96.50'}}};
    if(mode==='legacy'){delete data.snapshot.version;delete data.snapshot.cash.bridge;data.snapshot.cash.opening='100.00';}
    window.__qaWrites=0;window.fetch=async(url,options={})=>{if(!String(url).startsWith('https://cash-daily.invalid/'))throw Error('API outside isolated QA');if(options.method==='POST'){window.__qaWrites++;data.status='FINALIZED';return Response.json({replayed:false,view:data})}return Response.json(data)};
    createRoot(document.getElementById('preview')).render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Page/></QueryClientProvider></MemoryRouter>);
  `},plugins:[{name:'cash-daily-isolation',setup(b){
    b.onLoad({filter:/\/services\/api\.ts$/},()=>({contents:"export const getApiBaseUrl=()=> 'https://cash-daily.invalid';export const getAuthToken=()=>null;"}))
    b.onLoad({filter:/\/context\/useTenant\.ts$/},()=>({contents:"export const useTenant=()=>({company:{id:'c'},branch:{id:'b',name:'Principal'}});"}))
    b.onLoad({filter:/\/hooks\/useAuthPermissions\.ts$/},()=>({contents:"export const useAuthPermissions=()=>({user:{id:'u'},isAdmin:false,hasPermission:()=>true});"}))
    b.onLoad({filter:/\/hooks\/useSystemSettings\.ts$/},()=>({contents:"export const useSystemSettings=()=>({locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'});"}))
    b.onLoad({filter:/\/components\/layout\/PageNavigation\.tsx$/},()=>({contents:"export const usePageTrail=()=>{};"}))
  }}],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"'}})
  fs.mkdirSync(out,{recursive:true})
  const css=fs.readdirSync(path.join(root,'dist/assets')).filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync(path.join(root,'dist/assets',n),'utf8')).join('\n')
  fs.writeFileSync(path.join(out,'cash-daily-preview.js'),outputFiles[0].text)
  fs.writeFileSync(path.join(out,'cash-daily-preview.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><aside style="position:fixed;inset:0 auto 0 0;width:48px;border-right:1px solid hsl(var(--border));padding-top:16px;text-align:center">A</aside><main style="margin-left:48px"><header class="border-b px-4 py-3 text-sm">Cajas / Cierre del día · Ejemplo sin conexión</header><div id="preview"></div></main><script src="cash-daily-preview.js"></script></body></html>`)
  console.log('Cash daily real-page preview generated with synthetic data only')
}
build().catch(e=>{console.error(e);process.exitCode=1})

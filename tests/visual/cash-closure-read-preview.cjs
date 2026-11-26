// Real Auna history page with synthetic, isolated API and identity providers.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/playwright')
async function build(){
 const {outputFiles}=await esbuild.build({stdin:{resolveDir:root,sourcefile:'cash-read-preview.tsx',loader:'tsx',contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Page from '@/modules/cash-closure/CashClosureManagement';import {ClosureDetailPage} from '@/modules/cash-closure/ClosureDetailPage';
 const mode=new URLSearchParams(location.search).get('mode')||'cashier';window.__qa={companyId:'company-A',branchId:'branch-A',actorId:'user-A',mode};window.__qaWrites=0;window.__qaRequests=[];
 window.fetch=async(url,options={})=>{if(!String(url).startsWith('https://cash-read.invalid/'))throw Error('API outside isolated QA');if(options.method&&options.method!=='GET'){window.__qaWrites++;throw Error('Read-only preview')}
 const u=new URL(url),company=options.headers['X-Company-Id'],entry={path:u.pathname,scope:u.searchParams.get('scope'),company,finished:false};window.__qaRequests.push(entry);
 if(u.pathname.endsWith('/read-capabilities'))return Response.json({viewOwn:true,viewTeam:['auditor','supervisor'].includes(window.__qa.mode)});
 if(window.__qaDelay)await new Promise(r=>setTimeout(r,window.__qaDelay));
 entry.finished=true;
 if(u.pathname.endsWith('/review'))return Response.json({message:'Flujo anterior'},{status:404});
 if(u.pathname.endsWith('/detail')){if(window.__qa.denied||mode==='detail-denied')return Response.json({message:'Sin acceso'},{status:403});return Response.json({id:'detail',closure_number:123,date:'2026-11-19T17:00:00Z',start_date:'2026-11-19T14:00:00Z',end_date:'2026-11-19T17:00:00Z',cashier_name:'Mi turno · '+company,status:'Aprobado',theoretical_total:100,actual_total:98,difference:-2,total_transactions:1,total_customers:1,average_ticket:100,payment_breakdowns:[],denominations:[],cash_register_session:null})}
 if(mode==='error')return Response.json({message:'Sin acceso'},{status:403});
 const team=u.searchParams.get('scope')==='team',page=Number(u.searchParams.get('page')||1),empty=mode==='empty';
 const items=empty?[]:[{id:'closure-'+company+'-'+page,closure_number:page===1?123:124,date:'2026-11-19T17:00:00Z',start_date:'2026-11-19T14:00:00Z',end_date:'2026-11-19T17:00:00Z',cashier_name:(team?'Equipo · ':'Mi turno · ')+company,status:'Aprobado',theoretical_total:100,actual_total:98,difference:-2,cash_register_session:{cashRegister:{name:'Mostrador',code:'CAJA-01'}}}];
 return Response.json({items,page,pageSize:20,totalItems:empty?0:21,totalPages:empty?1:2,summary:{total:empty?0:21,Aprobado:empty?0:21,Pendiente:0,Rechazado:0}})};
 createRoot(document.getElementById('preview')).render(<MemoryRouter initialEntries={[mode.startsWith('detail')?'/cierre-caja/detail':'/']}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Routes><Route path="/" element={<Page/>}/><Route path="/cierre-caja/:id" element={<ClosureDetailPage/>}/></Routes></QueryClientProvider></MemoryRouter>);
 `},plugins:[{name:'cash-read-isolation',setup(b){
 b.onLoad({filter:/\/services\/api\.ts$/},()=>({contents:"export const getApiBaseUrl=()=> 'https://cash-read.invalid';export const getAuthToken=()=>null;"}));
 b.onLoad({filter:/\/context\/useTenant\.ts$/},()=>({contents:"import {useSyncExternalStore} from 'react';export const useTenant=()=>{const q=useSyncExternalStore(fn=>{addEventListener('qa-context',fn);return()=>removeEventListener('qa-context',fn)},()=>window.__qa);return {company:{id:q.companyId},branch:{id:q.branchId,name:'Principal'},isConsolidated:false}}"}));
 b.onLoad({filter:/\/context\/useAuth\.ts$/},()=>({contents:"export const useAuth=()=>({user:{id:window.__qa.actorId,role:{name:'vendedor'}}});"}));
 b.onLoad({filter:/\/hooks\/useAuthPermissions\.ts$/},()=>({contents:"export const useAuthPermissions=()=>({user:{id:window.__qa.actorId},hasPermission:(...codes)=>codes.some(c=>['cashclosure.view',...(['auditor','supervisor'].includes(window.__qa.mode)?['cashclosure.view_team']:[]),...(window.__qa.mode==='supervisor'?['cashclosure.approve']:[])].includes(c))});"}));
 b.onLoad({filter:/\/hooks\/useSystemSettings\.ts$/},()=>({contents:"export const useSystemSettings=()=>({timezone:'America/Guatemala',locale:'es-GT',currencyCode:'GTQ'});"}));
 b.onLoad({filter:/\/components\/layout\/PageNavigation\.tsx$/},()=>({contents:"export const usePageTrail=()=>{};"}));
 b.onLoad({filter:/\/cash-closure\/CashClosureCreatePage\.tsx$/},()=>({contents:"export const CASH_CLOSURE_CREATE_PATH='/cierre-caja/nuevo';"}));
 b.onLoad({filter:/\/cash-closure\/hooks\/index\.ts$/},()=>({contents:"export {useCashClosureAPI} from './useCashClosureAPI';export const useMineClosureGate=()=>({gate:{loading:false},refresh(){}});export const canRegisterMineClosure=()=>false;export const mineClosureBlockedHint=()=>'';"}));
 }}],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"'}})
 fs.mkdirSync(out,{recursive:true});fs.cpSync(path.join(root,'public/illustrations'),path.join(out,'illustrations'),{recursive:true})
 const mainCss=fs.readFileSync(path.join(root,'dist/index.html'),'utf8').match(/href="\/assets\/([^\"]+\.css)"/)[1]
 const css=[fs.readFileSync(path.join(root,'dist/assets',mainCss),'utf8'),...['src/components/shared/compactList.css','src/modules/cash-closure/cash-closure-workflow.css'].map(file=>fs.readFileSync(path.join(root,file),'utf8'))].join('\n')
 fs.writeFileSync(path.join(out,'cash-read-preview.js'),outputFiles[0].text)
 fs.writeFileSync(path.join(out,'cash-read-preview.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><aside style="position:fixed;inset:0 auto 0 0;width:48px;border-right:1px solid hsl(var(--border));text-align:center;padding-top:16px">A</aside><div style="margin-left:48px"><header class="border-b px-4 py-3 text-sm">Cajas · Ejemplo sin conexión</header><div id="preview"></div></div><script src="cash-read-preview.js"></script></body></html>`)
 console.log('Generated isolated real-page closure read preview')
}
build().catch(e=>{console.error(e);process.exitCode=1})

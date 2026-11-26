// Isolated QA preview: real customer statement page with a dispute charge and recovery credit, fake API on an .invalid host.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/qa/cartera-charges')
const ids={company:'00000000-0000-4000-8000-00000000000a',branch:'00000000-0000-4000-8000-00000000000b',user:'00000000-0000-4000-8000-0000000000aa',customer:'00000000-0000-4000-8000-0000000000c5'}
async function build(){
 const stub=`const ids=${JSON.stringify(ids)};
localStorage.setItem('tenant:companyId',ids.company);localStorage.setItem('tenant:branchId',ids.branch);localStorage.setItem('auth:user',JSON.stringify({id:ids.user}));
window.__requests=[];window.__unknown=[];
const statement={history:{page:1,pageSize:100,total_sales:2,total_payments:2,hasNextPage:false},
 customer:{id:ids.customer,name:'Comercial El Sol, S.A.',contact:'Marta Pérez',phone:'5555-1234',email:null,address:'Zona 10, Guatemala',tax_id:'1234567-8',credit_limit:5000,payment_term:{name:'Crédito 30 días',net_days:30}},
 resumen:{saldo:290,vencido:60,vencido_30_mas:0,facturas_abiertas:1,facturas_vencidas:0,cargos_abiertos:1,cargos_vencidos:1,cargos_saldo:60,documentos_abiertos:2,documentos_vencidos:1,credito_disponible:0,credito_en_revision:0,credito_recuperacion:15,saldo_neto:275,disponible:4725},
 ventas:[{id:'s1',reference:'V-PRIN-000120',date:'2026-10-02T15:00:00Z',due_date:'2026-11-01T05:59:59Z',total:500,abonado:500,saldo:0,payment_status:'PAID',vencida:false,dias_vencida:0},
  {id:'s2',reference:'V-PRIN-000145',date:'2026-11-20T15:00:00Z',due_date:'2026-12-20T05:59:59Z',total:230,abonado:0,saldo:230,payment_status:'PENDING',vencida:false,dias_vencida:0}],
 cobros:[{id:'p1',amount:500,paid_at:'2026-10-03T16:00:00Z',reference:'TARJ-8812',notes:null,kind:'PAYMENT',payment_method:{id:2,name:'Tarjeta'},registered_by:{id:ids.user,name:'Ana López'},aplicado:500,no_aplicado:0,comprometido:0,devuelto:0,retenido:0,saldo_cancelado:0,tiene_disputa:true,aplicaciones:[{sale_id:'s1',reference:'V-PRIN-000120',amount:500}]},
  {id:'p2',amount:40,paid_at:'2026-11-18T16:00:00Z',reference:'EF-0091',notes:null,kind:'PAYMENT',payment_method:{id:1,name:'Efectivo'},registered_by:{id:ids.user,name:'Ana López'},aplicado:40,no_aplicado:0,comprometido:0,devuelto:0,retenido:0,saldo_cancelado:0,aplicaciones:[{charge_id:'c1',documentType:'DISPUTE_CHARGE',reference:'CC-PRIN-000001',amount:40}]}],
 cargos:[{id:'c1',tipo:'CARGO_CONTRACARGO',reference:'CC-PRIN-000001',date:'2026-11-05T12:00:00.000Z',due_date:'2026-11-15T12:00:00.000Z',total:100,abonado:40,recuperado:0,saldo:60,vencido:true,dias_vencido:10,dispute_id:'d1',referencia_proveedor:'VISA-CB-2201',motivo:'El cliente reconoce el contracargo'}],
 creditos_recuperacion:[{id:'k1',origen:'Recuperación de contracargo',disponible:15,created_at:'2026-11-22T15:00:00Z'}]};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(url,options={})=>{
 const u=new URL(String(url),location.href);if(u.hostname!=='cartera-charges.invalid')throw Error('API outside isolated QA '+u);
 const p=u.pathname.replace(/^(\\/api)+/,''),method=options.method||'GET';window.__requests.push(method+' '+p);
 if(p.startsWith('/receivables/customers/'))return json(statement);
 if(p.startsWith('/catalogs/payment-methods'))return json([{id:1,name:'Efectivo',is_credit:false,active:true},{id:2,name:'Tarjeta',is_credit:false,active:true}]);
 if(p.startsWith('/cash-sessions/current'))return json({ok:true,session:{id:'session',status:'OPEN',can_operate:true}});
 window.__unknown.push(method+' '+p+u.search);return json({items:[],data:[]});
};`
 const {outputFiles}=await esbuild.build({stdin:{resolveDir:root,loader:'tsx',sourcefile:'cartera-charges-preview.tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Page from '@/modules/receivables/pages/CustomerStatementPage';import {Toaster} from '@/components/ui/toaster';
const q=new URLSearchParams(location.search),client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const route='/cartera/${ids.customer}'+(q.has('cobrar')?'?cobrar=1':'');
createRoot(document.getElementById('preview')).render(<MemoryRouter initialEntries={[route]}><QueryClientProvider client={client}><Routes><Route path='/cartera/:id' element={<Page/>}/><Route path='*' element={<p>Ruta de ejemplo</p>}/></Routes><Toaster/></QueryClientProvider></MemoryRouter>);
`},plugins:[{name:'isolated-cartera',setup(b){
 b.onLoad({filter:/\/context\/useTenant\.ts$/},()=>({contents:`export const useTenant=()=>({company:{id:'${ids.company}',name:'Auna QA'},branch:{id:'${ids.branch}',name:'Principal'},branches:[{id:'${ids.branch}',name:'Principal'}],isConsolidated:false,registerTenantExitGuard:()=>()=>{}});export default useTenant;`}));
 b.onLoad({filter:/\/context\/useAuth\.ts$/},()=>({contents:`export const useAuth=()=>({user:{id:'${ids.user}',name:'Ana López',role:{name:'cajero'},permissions:[]}});export default useAuth;`}));
 b.onLoad({filter:/\/context\/useModules\.ts$/},()=>({contents:"export const useModules=()=>({isEnabled:()=>false,modules:[]});"}));
 b.onLoad({filter:/\/hooks\/useAuthPermissions\.ts$/},()=>({contents:`export const useAuthPermissions=()=>({user:{id:'${ids.user}'},permissionsReady:true,hasPermission:(...c)=>c.some(x=>['receivables.view','receivables.manage','contacts.clients.view'].includes(x))});`}));
 b.onLoad({filter:/\/hooks\/useSystemSettings\.ts$/},()=>({contents:"export const useSystemSettings=()=>({locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala',companyName:'Auna QA',companyLogoUrl:null});"}));
 b.onResolve({filter:/\\?url$/},a=>({path:a.path,namespace:'qa-url'}));b.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:'export default "data:,"'}));
 b.onLoad({filter:/\/components\/layout\/PageNavigation\.tsx$/},()=>({contents:"export const usePageTrail=()=>{};"}));
 }}],banner:{js:stub},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.svg':'dataurl'},alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{"VITE_API_URL":"https://cartera-charges.invalid/api","DEV":false,"PROD":true,"MODE":"qa"}'}})
 fs.mkdirSync(out,{recursive:true});if(fs.existsSync(path.join(root,'public/illustrations')))fs.cpSync(path.join(root,'public/illustrations'),path.join(out,'illustrations'),{recursive:true})
 const mainCss=fs.readFileSync(path.join(root,'dist/index.html'),'utf8').match(/href="\/assets\/([^"]+\.css)"/)[1]
 const css=[fs.readFileSync(path.join(root,'dist/assets',mainCss),'utf8'),fs.readFileSync(path.join(root,'src/modules/receivables/pages/customerStatement.css'),'utf8')].join('\n')
 fs.writeFileSync(path.join(out,'cartera.js'),outputFiles[0].text)
 fs.writeFileSync(path.join(out,'cartera.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>${css}</style><script>if(new URLSearchParams(location.search).has('dark'))document.documentElement.classList.add('dark')</script></head><body class="bg-background text-foreground"><div id="preview"></div><script src="cartera.js"></script></body></html>`)
 console.log('Cartera charges preview prepared in output/qa/cartera-charges')
}
build().catch(e=>{console.error(e);process.exitCode=1})

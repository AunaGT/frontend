// Real form/list components with synthetic API responses. Never contacts the application API.
const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild')
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'output/playwright')
async function build() {
  const { outputFiles } = await esbuild.build({ stdin: { resolveDir: root, sourcefile: 'cash-register-preview.tsx', loader: 'tsx', contents: `
    import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter } from 'react-router-dom'; import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
    import Form from '@/modules/catalogs/pages/CashRegisterFormPage'; import { CashRegistersTab } from '@/modules/catalogs/components/CashRegistersTab';
    const params=new URLSearchParams(location.search),mode=params.get('mode')||'edit',key='qa:cash3a:record';
    document.documentElement.classList.toggle('dark',params.has('dark'));
    const original={id:'00000000-0000-4000-8000-000000000001',branch_id:'b',name:'Mostrador principal',code:'CAJA-01',active:true,is_default:false,kind:'PHYSICAL',operation_mode:'INDIVIDUAL',currency_code:'GTQ',revision:2,money_event_version:0,access_control_version:0,authorized_users:[{id:'u',name:'Ana López',active:true}],legacy_suggested_users:[{id:'v',name:'Luis Pérez'}],has_open_session:false,has_pending_closure:false,capabilities:{register_configuration_available:true,can_enable_explicit_access:false}};
    const people=Array.from({length:24},(_,i)=>({id:i===0?'u':'user-'+i,name:i===0?'Ana López':i===1?'Luis Pérez':'Persona del equipo '+String(i).padStart(2,'0')}));
    window.__qaRequests=[]; window.__qaDeny=false; window.__qaLost=params.has('lost');
    window.fetch=async(url,options={})=>{if(!String(url).startsWith('https://cash-preview.invalid/'))throw Error('La vista QA no permite acceso a otra API');const route=new URL(url),body=options.body?JSON.parse(options.body):null;window.__qaRequests.push({path:route.pathname,body});let row=JSON.parse(sessionStorage.getItem(key)||'null')||original;
      if(route.pathname.endsWith('/capabilities'))return Response.json({register_configuration_available:!params.has('unavailable'),money_events_available:true,can_adopt:false,can_manage_register_configuration:true});
      if(route.pathname.endsWith('/register-users')){const search=route.searchParams.get('search')||'',page=Number(route.searchParams.get('page')||1),found=people.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));return Response.json({items:found.slice((page-1)*20,page*20),page,pageSize:20,totalItems:found.length,totalPages:Math.max(1,Math.ceil(found.length/20))})}
      if(!body && route.pathname.endsWith('/registers'))return Response.json([{...row,authorized_user_count:row.authorized_users.length}]);
      if(!body)return Response.json(row);
      if(window.__qaDeny)return Response.json({message:'Permiso de prueba revocado'}, {status:403});
      const commands=JSON.parse(sessionStorage.getItem('qa:cash3a:commands')||'{}');if(commands[body.requestKey])return Response.json({...commands[body.requestKey],replayed:true});
      if(options.method==='PUT'&&body.expectedRevision!==row.revision)return Response.json({code:'CASH_CONFIGURATION_STALE',message:'La caja cambió. Tu borrador se conserva.'},{status:409});
      row={...row,name:body.name,code:body.code||row.code,revision:row.revision+1,authorized_users:(body.authorizedUserIds||[]).map(id=>({...people.find(p=>p.id===id),active:true})),command_id:'qa-receipt-'+body.requestKey,replayed:false};commands[body.requestKey]=row;sessionStorage.setItem('qa:cash3a:commands',JSON.stringify(commands));sessionStorage.setItem(key,JSON.stringify(row));
      if(window.__qaLost){window.__qaLost=false;throw Error('Respuesta perdida de prueba')};return Response.json(row);
    };
    createRoot(document.getElementById('preview')).render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{mode==='list'?<div className="p-4 sm:p-6"><CashRegistersTab/></div>:<Form mode={mode==='create'?'create':mode==='view'?'view':'edit'} registerId={mode==='create'?undefined:original.id}/>}</QueryClientProvider></MemoryRouter>);
  ` }, plugins: [{ name: 'isolated-cash-preview', setup(build) {
    build.onLoad({ filter: /\/services\/api\.ts$/ }, () => ({ contents: `export const getApiBaseUrl=()=> 'https://cash-preview.invalid';export const getAuthToken=()=>null;` }))
    build.onLoad({ filter: /\/context\/useTenant\.ts$/ }, () => ({ contents: `const guard=()=>()=>{};export const useTenant=()=>({company:{id:'c',name:'Empresa de ejemplo'},branch:{id:'b',name:'Sucursal principal'},registerTenantExitGuard:guard});` }))
    build.onLoad({ filter: /\/hooks\/useAuthPermissions\.ts$/ }, () => ({ contents: `export const useAuthPermissions=()=>({user:{id:'u'},isAdmin:false,permissionsReady:true,hasPermission:()=>true});` }))
    build.onLoad({ filter: /\/components\/layout\/PageNavigation\.tsx$/ }, () => ({ contents: `export const usePageTrail=()=>{};` }))
    build.onLoad({ filter: /\/catalogs\/components\/CatalogAccess\.tsx$/ }, () => ({ loader: 'tsx', contents: `export const CatalogAccess=({children})=>children;` }))
  } }], bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' } })
  fs.mkdirSync(output, { recursive: true })
  const css = fs.readdirSync(path.join(root, 'dist/assets')).filter(name => name.endsWith('.css')).map(name => fs.readFileSync(path.join(root, 'dist/assets', name), 'utf8')).join('\n')
  fs.writeFileSync(path.join(output, 'cash-register-configuration-preview.js'), outputFiles[0].text)
  fs.writeFileSync(path.join(output, 'cash-register-configuration-preview.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><aside aria-label="Navegación" style="position:fixed;inset:0 auto 0 0;width:48px;border-right:1px solid hsl(var(--border));background:hsl(var(--background));text-align:center;padding-top:16px">A</aside><div style="margin-left:48px"><header style="padding:12px 20px;border-bottom:1px solid hsl(var(--border));font-size:13px">Configuración / Cajas <span style="float:right">Ejemplo sin conexión</span></header><div id="preview"></div></div><script src="cash-register-configuration-preview.js"></script></body></html>`)
  console.log('Vista QA generada sin conexión a la API de Auna')
}
build().catch(error => { console.error(error); process.exitCode = 1 })

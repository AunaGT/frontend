// Isolated QA preview for packages in POS and direct sale: real React pages, fake API on an .invalid host.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/qa/sale-packages')
const ids={company:'00000000-0000-4000-8000-00000000000a',branch:'00000000-0000-4000-8000-00000000000b',user:'00000000-0000-4000-8000-0000000000aa',pkg:'00000000-0000-4000-8000-0000000000c1',p1:'00000000-0000-4000-8000-0000000000d1',p2:'00000000-0000-4000-8000-0000000000d2',p3:'00000000-0000-4000-8000-0000000000d3'}
async function build(){
 const stub=`const ids=${JSON.stringify(ids)};
localStorage.setItem('tenant:companyId',ids.company);localStorage.setItem('tenant:branchId',ids.branch);localStorage.setItem('auth:user',JSON.stringify({id:ids.user}));
window.__requests=[];window.__writes=[];window.__unknown=[];
const product=(id,name,price)=>({id,name,sku:name.slice(0,3).toUpperCase(),barcode:null,price,price_wholesale:price,stock:40,available_stock:40,min_stock:0,category:'Bebidas',brand:'Auna',kind:'STANDARD',quantity_decimals:0,image_url:null,active:true,service_unit_label:null});
const products=[product(ids.p1,'Shot de limón',12),product(ids.p2,'Shot de fresa',12),product(ids.p3,'Hielera',150)];
const definition={schemaVersion:1,name:'Fiesta de shots',description:'Barra de shots para eventos',imageUrl:null,currency:'GTQ',variants:[{id:'v80',name:'80 shots',price:'1599.00',components:[{id:'c1',productId:ids.p3,presentationId:null,unitRevision:null,quantity:'1',weight:null}],choices:[{id:'flavors',name:'Sabores',totalQuantity:'80',maxDistinct:2,weight:null,options:[{id:'o1',productId:ids.p1,presentationId:null,unitRevision:null},{id:'o2',productId:ids.p2,presentationId:null,unitRevision:null}]}]}]};
const summary={id:ids.pkg,name:definition.name,version:3,activeVersion:3,archivedAt:null,branchIds:[ids.branch],currency:'GTQ',variantCount:1,priceFrom:'1599.00',priceTo:'1599.00'};
function groups(packages){return packages.map(s=>{const chosen=(s.choices.find(c=>c.choiceId==='flavors')?.items??[]).reduce((n,i)=>n+Number(i.quantity),0),done=chosen===80;
 return{schemaVersion:1,groupId:s.groupId,packageId:s.packageId,version:s.version,variantId:s.variantId,name:definition.name,variantName:'80 shots',currency:'GTQ',state:done?'COMPLETE':'INCOMPLETE',estimatedAmount:'1599.00',amount:done?'1599.00':null,netAmount:done?'1599.00':null,selection:s,
  issues:done?[]:[{code:'CHOICE_INCOMPLETE',choiceId:'flavors',message:'Falta completar Sabores',remainingQuantity:String(80-chosen)}],
  components:done?[{key:s.groupId+':c1',productId:ids.p3,itemName:'Hielera',itemKind:'STANDARD',quantity:'1',unitLabel:'unidad',quantityDecimals:0,unitPrice:'159.00',lineTotal:'159.00',netLineTotal:'159.00'},...s.choices[0].items.map(i=>({key:s.groupId+':'+i.optionId,productId:i.optionId==='o1'?ids.p1:ids.p2,itemName:i.optionId==='o1'?'Shot de limón':'Shot de fresa',itemKind:'STANDARD',quantity:i.quantity,unitLabel:'unidad',quantityDecimals:0,unitPrice:'18.00',lineTotal:(Number(i.quantity)*18).toFixed(2),netLineTotal:(Number(i.quantity)*18).toFixed(2)}))]:[]}})}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(url,options={})=>{
 const u=new URL(String(url),location.href);if(u.hostname!=='sale-packages.invalid')throw Error('API outside isolated QA '+u);
 const p=u.pathname.replace(/^(\\/api)+/,''),method=options.method||'GET',body=options.body&&typeof options.body==='string'?JSON.parse(options.body):null;window.__requests.push({p,method,body});
 if(p==='/sales/packages')return json({items:[summary],nextCursor:null});
 if(p==='/sales/packages/preview'){const g=groups(body.packages);return json({packageGroups:g,subtotal:'0',issues:g.flatMap(x=>x.issues)})}
 if(p.startsWith('/sales/packages/'))return json({...summary,definition,activeDefinition:definition,references:products.map(x=>({id:x.id,name:x.name,unitLabel:'unidad',presentations:[]}))});
 if(p==='/sales/drafts/preview'){const g=body.packages?groups(body.packages):undefined;if(g?.some(x=>x.state!=='COMPLETE'))return json({message:'Completa la selección del paquete'},409);const free=body.items.map(i=>({unitPrice:'12',lineTotal:(Number(i.qty)*12).toFixed(2),unitSnapshot:null,baseQty:i.qty}));return json({total:(free.reduce((n,i)=>n+Number(i.lineTotal),0)+(g?.length??0)*1599).toFixed(2),items:free,...(g?{packageGroups:g}:{})})}
 if(p==='/sales/drafts'&&method==='POST'){window.__writes.push(body);const g=groups(body.packages??[]);return json({id:'00000000-0000-4000-8000-0000000000e1',reference:'V-0042',version:1,status:'DRAFT',originQuote:null,customerId:null,customerName:body.customerName,customerNit:body.customerNit,total:'1599.00',dueDate:null,packageGroups:g,items:g.flatMap(x=>x.components.map((c,i)=>({id:i+1,packageComponentKey:c.key,productId:c.productId,name:c.itemName,kind:'STANDARD',qty:c.quantity,unitPrice:c.unitPrice,lineTotal:c.lineTotal,unitLabel:'unidad',quantityDecimals:0,unitSnapshot:null,unitMetadataVersion:1,baseQty:c.quantity})))})}
 if(p==='/sales'&&method==='POST'){window.__writes.push(body);return json({id:'00000000-0000-4000-8000-0000000000f1',reference:'V-0043'},201)}
 if(p.startsWith('/cash-sessions/current'))return json({ok:true,register:{id:'register',name:'Mostrador',register_type:'PHYSICAL'},session:{id:'session',status:'OPEN',opened_by_id:ids.user,opened_at:new Date().toISOString(),openedBy:{name:'Ana López'}}});
 if(p==='/warehouses')return json([]);
 if(p.startsWith('/settings/hardware'))return json({destination:null,destinations:[]});
 if(p.startsWith('/catalogs/payment-methods'))return json([{id:1,name:'Efectivo',is_credit:false,active:true,allowed_on_register:true},{id:2,name:'Tarjeta',is_credit:false,active:true,allowed_on_register:true}]);
 if(p.startsWith('/payment-methods'))return json([{id:1,name:'Efectivo',is_credit:false,active:true,allowed_on_register:true},{id:2,name:'Tarjeta',is_credit:false,active:true,allowed_on_register:true}]);
 if(p.startsWith('/products/pos-catalog')||p.startsWith('/products/catalog')||p==='/products')return json({items:products,page:1,pageSize:18,totalItems:products.length,totalPages:1,missingIds:[]});
 if(p.startsWith('/categories')||p.includes('categories'))return json({items:[{name:'Bebidas',count:3,image_url:null}]});
 if(p.includes('pricing')||p.includes('prices'))return json({unit_prices:Object.fromEntries(products.map(x=>[x.id,x.price])),price_tier_used:'LIST'});
 if(p.includes('availability'))return json({items:products.map(x=>({product_id:x.id,available:'40',on_hand:'40'})),availability:Object.fromEntries(products.map(x=>[x.id,{available:40}])),salesLocation:{configured:true,id:'L'}});
 window.__unknown.push(method+' '+p+u.search);return json({items:[],data:[]});
};
`
 const {outputFiles}=await esbuild.build({stdin:{resolveDir:root,loader:'tsx',sourcefile:'sale-packages-preview.tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Pos from '@/modules/sales/NewSalePage';import Manual from '@/modules/sales/ManualSalePage';import {Toaster} from '@/components/ui/toaster';
const q=new URLSearchParams(location.search);
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const route=q.get('page')==='manual'?'/ventas/nueva':'/ventas/pos?caja=register';
createRoot(document.getElementById('preview')).render(<MemoryRouter initialEntries={[route]}><QueryClientProvider client={client}><Routes><Route path='/ventas/pos' element={<Pos/>}/><Route path='/ventas/nueva' element={<Manual/>}/><Route path='*' element={<p>Ruta de ejemplo</p>}/></Routes><Toaster/></QueryClientProvider></MemoryRouter>);
`},plugins:[{name:'isolated-sale-packages',setup(b){
 b.onLoad({filter:/\/context\/useTenant\.ts$/},()=>({contents:`export const useTenant=()=>({company:{id:'${ids.company}',name:'Auna QA'},branch:{id:'${ids.branch}',name:'Principal'},branches:[{id:'${ids.branch}',name:'Principal'}],isConsolidated:false,registerTenantExitGuard:()=>()=>{}});export default useTenant;`}));
 b.onLoad({filter:/\/context\/useAuth\.ts$/},()=>({contents:`export const useAuth=()=>({user:{id:'${ids.user}',name:'Ana López',role:{name:'cajero'},permissions:['sales.create']}});export default useAuth;`}));
 b.onLoad({filter:/\/context\/useModules\.ts$/},()=>({contents:"export const useModules=()=>({isEnabled:()=>false,modules:[]});"}));
 b.onLoad({filter:/\/hooks\/useAuthPermissions\.ts$/},()=>({contents:`export const useAuthPermissions=()=>({user:{id:'${ids.user}'},permissionsReady:true,hasPermission:(...c)=>c.some(x=>['sales.create','contacts.clients.view'].includes(x))});`}));
 b.onLoad({filter:/\/hooks\/useSystemSettings\.ts$/},()=>({contents:"export const useSystemSettings=()=>({locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala',companyName:'Auna QA',vatRegime:'general',ivaRate:12,salesAllowCredit:true,salesShowFiscalFields:true,salesShowChannels:false,inventoryUnitsEnabled:false});"}));
 b.onResolve({filter:/\?url$/},a=>({path:a.path,namespace:'qa-url'}));b.onLoad({filter:/.*/,namespace:'qa-url'},()=>({contents:'export default "data:,"'}));
 b.onLoad({filter:/\/components\/layout\/PageNavigation\.tsx$/},()=>({contents:"export const usePageTrail=()=>{};"}));
 }}],banner:{js:stub},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.svg':'dataurl'},alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{"VITE_API_URL":"https://sale-packages.invalid/api","DEV":false,"PROD":true,"MODE":"qa"}'}})
 fs.mkdirSync(out,{recursive:true});if(fs.existsSync(path.join(root,'public/illustrations')))fs.cpSync(path.join(root,'public/illustrations'),path.join(out,'illustrations'),{recursive:true})
 const mainCss=fs.readFileSync(path.join(root,'dist/index.html'),'utf8').match(/href="\/assets\/([^"]+\.css)"/)[1]
 const css=[fs.readFileSync(path.join(root,'dist/assets',mainCss),'utf8'),fs.readFileSync(path.join(root,'src/modules/sales/pos.css'),'utf8')].join('\n')
 fs.writeFileSync(path.join(out,'sale-packages.js'),outputFiles[0].text)
 fs.writeFileSync(path.join(out,'sale-packages.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>${css}</style><script>if(new URLSearchParams(location.search).has('dark'))document.documentElement.classList.add('dark')</script></head><body class="bg-background text-foreground"><div id="preview"></div><script src="sale-packages.js"></script></body></html>`)
 console.log('Sale packages preview prepared in output/qa/sale-packages')
}
build().catch(e=>{console.error(e);process.exitCode=1})

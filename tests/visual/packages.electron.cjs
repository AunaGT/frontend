// Isolated view rendering with real controls/CSS; no application session or network.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom')
const postcss=require('postcss'),tailwind=require('tailwindcss'),{loadReportModule}=require('../helpers/loadReportModule.cjs'),{hookHarness}=require('../helpers/reportHookHarness.cjs')
const root=path.resolve(__dirname,'../..');process.chdir(root);app.disableHardwareAcceleration()
async function run(){
 const h=hookHarness(),scope={companyId:'a',branchId:'b',userId:'u',sessionId:'s'}
 const {PackageEditor}=loadReportModule('../inventory/packages/PackageEditorPage.tsx',{
  react:h.hooks,'./api':{},'./usePackageScope':{},
  '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries(){}})},
  '@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({currencyCode:'GTQ'})},
  '@/modules/appointments/components/DraftGuard':{useDraftGuard:()=>({dialog:null,request:fn=>fn(),proceed:fn=>fn()})},
  'react-router-dom':{...require('react-router-dom'),useNavigate:()=>()=>{}},
 })
 const tree=h.render(()=>PackageEditor({context:{scope,key:'qa',canRead:true,canEdit:true,branches:[{id:'b',name:'Principal'}]}}))
 const markup=renderToStaticMarkup(React.createElement(MemoryRouter,null,tree))
 const styles=await postcss([tailwind({config:path.join(root,'tailwind.config.ts')})]).process(fs.readFileSync('src/index.css','utf8'),{from:path.join(root,'src/index.css')})
 const css=styles.css+fs.readFileSync('src/components/ui/form-controls.css','utf8')+fs.readFileSync('src/components/shared/surfaces.css','utf8')
 const win=new BrowserWindow({show:false,width:1366,height:900,webPreferences:{sandbox:true,backgroundThrottling:false,offscreen:true}})
 await win.loadURL('about:blank');await win.webContents.executeJavaScript('document.open();document.write('+JSON.stringify('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><aside style="position:fixed;width:56px;height:100vh;border-right:1px solid gray" aria-label="Navegación de Auna"></aside><div style="margin-left:56px">'+markup+'</div></body></html>')+');document.close()')
 win.webContents.debugger.attach('1.3')
 fs.mkdirSync('output/playwright',{recursive:true})
 for(const width of [375,768,1440])for(const dark of [false,true]){
  await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
  const result=await win.webContents.executeJavaScript(`(async()=>{document.documentElement.classList.toggle('dark',${dark});await new Promise(r=>setTimeout(r,200));const input=document.querySelector('#package-name');input.focus();return{fits:document.documentElement.scrollWidth<=innerWidth,focused:document.activeElement===input,controlHeight:input.getBoundingClientRect().height,sidebar:!!document.querySelector('aside'),title:document.querySelector('h1').textContent,mainWidth:document.querySelector('main').getBoundingClientRect().width,inputBackground:getComputedStyle(input).backgroundColor}})()`)
  if(!result.fits)console.log(await win.webContents.executeJavaScript(`JSON.stringify([...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,60),right:el.getBoundingClientRect().right})))`))
  assert.ok(result.fits,'No horizontal overflow at '+width);assert.ok(result.focused);assert.ok(result.sidebar);assert.ok(result.controlHeight<=44,'Uses compact system input');assert.equal(result.title,'Nuevo paquete')
  if(width===1440){const capture=await win.webContents.capturePage();fs.writeFileSync('output/playwright/packages-'+(dark?'dark':'light')+'.png',capture.toPNG())}
  console.log('PASS packages '+width+' '+(dark?'dark':'light')+' '+JSON.stringify(result))
 }
 const {QuoteLines,QuoteSummary}=loadReportModule('../quotes/QuotePresentation.tsx',{'./api':{}})
 const group={schemaVersion:1,groupId:'g',name:'Experiencia Fiesta',variantName:'160 shots',currency:'GTQ',state:'COMPLETE',amount:'160.00',netAmount:'150.00',estimatedAmount:'160.00',issues:[],components:['Limón','Mora'].map((itemName,i)=>({key:'g:'+i,productId:String(i),itemName,itemKind:'STANDARD',quantity:'80',unitLabel:'unidad',quantityDecimals:0,unitPrice:'1',lineTotal:'80.00',netLineTotal:'75.00'}))}
 group.components.push({key:'g:service',productId:'service',itemName:'Atención del evento',itemKind:'SERVICE',quantity:'1',unitLabel:'hora',quantityDecimals:1,unitPrice:'0',lineTotal:'0.00',netLineTotal:'0.00',serviceConditions:{version:1,schedulingStyle:'WORK',durationPolicy:'FIXED',durationMinutes:60,allowedVenueKinds:['EVENT_VENUE'],publicInstructions:'Acceso lateral acordado'}})
 const lines=group.components.map(c=>({package_component_key:c.key,name:c.itemName,qty:c.quantity,unit_price:c.unitPrice,line_total:c.lineTotal}))
 const agreement=renderToStaticMarkup(React.createElement('main',{className:'mx-auto max-w-4xl space-y-5 p-4'},React.createElement('h1',null,'Cotización sintética'),React.createElement(QuoteLines,{groups:[group],lines,compact:true,money:n=>'Q '+n}),React.createElement(QuoteSummary,{subtotal:160,discount:10,total:150,money:n=>'Q '+n})))
 await win.webContents.executeJavaScript('document.body.innerHTML='+JSON.stringify(agreement))
 for(const width of [375,1440]){
  await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
  await win.webContents.executeJavaScript('(async()=>{document.documentElement.classList.remove("dark");document.querySelector("details").open=true;await new Promise(r=>setTimeout(r,200))})()')
  const fits=await win.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth');assert.ok(fits,'Agreement must not overflow')
  const capture=await win.webContents.capturePage();fs.writeFileSync('output/playwright/package-agreement-'+width+'.png',capture.toPNG());console.log('PASS agreement '+width)
 }
 win.destroy()
}
app.whenReady().then(run).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)})

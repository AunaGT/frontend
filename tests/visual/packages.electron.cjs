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
  const result=await win.webContents.executeJavaScript(`(()=>{document.documentElement.classList.toggle('dark',${dark});const input=document.querySelector('#package-name');input.focus();return{fits:document.documentElement.scrollWidth<=innerWidth,focused:document.activeElement===input,controlHeight:input.getBoundingClientRect().height,sidebar:!!document.querySelector('aside'),title:document.querySelector('h1').textContent,mainWidth:document.querySelector('main').getBoundingClientRect().width}})()`)
  if(!result.fits)console.log(await win.webContents.executeJavaScript(`JSON.stringify([...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,60),right:el.getBoundingClientRect().right})))`))
  assert.ok(result.fits,'No horizontal overflow at '+width);assert.ok(result.focused);assert.ok(result.sidebar);assert.ok(result.controlHeight<=44,'Uses compact system input');assert.equal(result.title,'Nuevo paquete')
  if(width===1440){const capture=await win.webContents.capturePage();fs.writeFileSync('output/playwright/packages-'+(dark?'dark':'light')+'.png',capture.toPNG())}
  console.log('PASS packages '+width+' '+(dark?'dark':'light')+' '+JSON.stringify(result))
 }
 win.destroy()
}
app.whenReady().then(run).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)})

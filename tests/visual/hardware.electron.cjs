// Offline geometry/contrast review of the real hardware components and current Auna CSS.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{MemoryRouter}=require('react-router-dom'),postcss=require('postcss'),tailwind=require('tailwindcss')
const {loadReportModule}=require('../helpers/loadReportModule.cjs'),root=path.resolve(__dirname,'../..')
process.chdir(root);app.disableHardwareAcceleration()
const base={companyId:'A',branchId:'B',notes:'',state:'ACTIVE',version:1},station={...base,id:'W',name:'Mostrador principal',code:'PC-01',cashRegisterId:'R'},devices=[
 {...base,id:'S',name:'Lector de mostrador',code:'LECTOR-01',kind:'SCANNER',connection:'HID',profile:{scannerSuffix:'ENTER',scannerMinLength:1,scannerMaxLength:128}},
 {...base,id:'P',name:'Tickets mostrador',code:'TICKET-01',kind:'RECEIPT_PRINTER',connection:'SYSTEM_PRINTER',profile:{widthMm:80,heightMm:160,dpi:203,orientation:'portrait',offsetXMm:0,offsetYMm:0,copies:1}},
 {...base,id:'L',name:'Etiquetas inventario',code:'LABEL-01',kind:'LABEL_PRINTER',connection:'SYSTEM_PRINTER',profile:{widthMm:60,heightMm:40,dpi:203,orientation:'landscape',offsetXMm:0,offsetYMm:0,copies:1}},
 {...base,id:'D',name:'Gaveta mostrador',code:'GAVETA-01',kind:'CASH_DRAWER',connection:'PRINTER_PORT',profile:{parentPrinterId:'P'}},
]
const workspace={workstations:[station],devices,assignments:[{workstationId:'W',deviceId:'S',role:'SCANNER'},{workstationId:'W',deviceId:'P',role:'RECEIPT'},{workstationId:'W',deviceId:'D',role:'DRAWER'}],registers:[{id:'R',name:'Principal',active:true}],totalItems:1,page:1,pageSize:50,totalPages:1}
function render(route,readonly=false,empty=false){
 const h={workspace:empty?{...workspace,workstations:[],devices:[],assignments:[]}:workspace,loading:false,error:'',notice:'',fields:{},canRead:true,canManage:!readonly,canTestPrint:!readonly,canTestDrawer:!readonly,disabled:readonly,pending:false,companyId:'A',branchId:'B',userId:'U',reload(){},setDirty(){},saveWorkstation(){},saveDevice(){}}
 const {HardwareSettingsSection}=loadReportModule('../config/hardware/HardwareSettingsSection.tsx',{'./useHardwareWorkspace':{useHardwareWorkspace:()=>h},'@/services/api':{},'@/hooks/useAuthPermissions':{useAuthPermissions:()=>({hasPermission:()=>true})},'@/context/useModules':{useModules:()=>({enabledModuleCodes:new Set(['inventory'])})}})
 const {SettingsNavigation}=loadReportModule('../config/components/SettingsNavigation.tsx')
 const frame=React.createElement('main',{className:'config-page auna-page-fluid mx-auto w-full min-w-0 space-y-5 p-4 sm:p-8'},React.createElement('div',{className:'config-center'},React.createElement(SettingsNavigation,{active:'hardware',onSelect(){},companyName:'Empresa de ejemplo'}),React.createElement('div',{className:'config-center-content space-y-5'},React.createElement('p',{className:'config-context-line'},'Se aplica a Empresa de ejemplo'),React.createElement(HardwareSettingsSection))))
 return renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[route]},frame)).replaceAll('/illustrations/empty-states/workspace-flat.png','data:image/png;base64,'+fs.readFileSync('public/illustrations/empty-states/workspace-flat.png').toString('base64'))
}
async function run(){
 // Vite resolves CSS imports and @layer ordering; raw Tailwind alone omits nativeControls.css.
 const css=fs.readdirSync('dist/assets').filter(p=>p.endsWith('.css')).map(p=>fs.readFileSync(path.join('dist/assets',p),'utf8')).join('\n')
 const win=new BrowserWindow({show:false,width:1366,height:1000,webPreferences:{sandbox:true,offscreen:true}})
 await win.loadURL('about:blank');win.webContents.debugger.attach('1.3')
 const cases=[['list',''],['empty','',false,true],['station','&puesto=nuevo&vista=editar'],['assigned','&puesto=W&vista=editar'],['scanner','&equipo=S&vista=editar'],['printer','&equipo=P&vista=editar'],['label','&equipo=L&vista=editar'],['drawer','&equipo=D&vista=editar'],['devices','&equipos=si'],['tests','&panel=pruebas'],['readonly','',true]]
 for(const [name,query,readonly,empty]of cases){
  const markup=render('/configuracion?seccion=hardware'+query,readonly,empty).replace(/src="(\/[^"?#]+\.svg)"/g,(match,file)=>fs.existsSync(path.join('public',file))?`src="data:image/svg+xml;base64,${fs.readFileSync(path.join('public',file)).toString('base64')}"`:match)
  for(const dark of [false,true])for(const width of [375,768,1440]){
   await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
   const html=`<!doctype html><html class="${dark?'dark':''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`
   await win.webContents.executeJavaScript('document.open();document.write('+JSON.stringify(html)+');document.close();')
   const result=await win.webContents.executeJavaScript(`(async()=>{await new Promise(r=>setTimeout(r,30));const fields=[...document.querySelectorAll('input,select')],content=document.querySelector('.config-center-content');return{fits:document.documentElement.scrollWidth<=innerWidth,fieldsFit:fields.every(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().left>=0),allNamed:fields.every(e=>e.id&&document.querySelector('label[for="'+e.id+'"]')||e.getAttribute('aria-label')||e.closest('label')),noBlackHole:getComputedStyle(content).backgroundColor,bodyBackground:getComputedStyle(document.querySelector('main')).backgroundColor,labels:fields.length,hasKeyboardTarget:!!document.querySelector('button')};})()`)
   assert.ok(result.fits,`${name} ${dark?'dark':'light'} ${width}: page overflow`);assert.ok(result.fieldsFit,`${name} ${width}: field overflow`);assert.ok(result.allNamed,`${name}: unnamed field`)
   if(dark&&name==='list'){
     const surface=await win.webContents.executeJavaScript(`(()=>{const color=getComputedStyle(document.querySelector('footer.auna-data-table-pagination')).backgroundColor;return{footer:color,frame:getComputedStyle(document.querySelector('.config-center')).backgroundColor}})()`)
     assert.ok(surface.footer==='rgba(0, 0, 0, 0)'||surface.footer===surface.frame,'Pagination must continue the configuration surface, not look recessed')
   }
   console.log(`PASS ${name} ${dark?'dark':'light'} ${width} ${JSON.stringify(result)}`)
   if(width===1440&&['list','printer','assigned'].includes(name)||width===375&&name==='printer'){const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`/tmp/auna-hardware-baseline-QVF4R5/ui-${name}-${dark?'dark':'light'}-${width}.png`,Buffer.from(shot.data,'base64'))}
  }
 }
 win.destroy()
}
app.whenReady().then(run).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)})

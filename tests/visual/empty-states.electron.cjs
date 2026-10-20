// Render the approved local artwork with the real component and application CSS. No network.
const {app,BrowserWindow}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const postcss=require('postcss'),tailwind=require('tailwindcss')
const {loadReportModule}=require('../helpers/loadReportModule.cjs')
const root=path.resolve(__dirname,'../..');process.chdir(root);app.disableHardwareAcceleration()
async function run(){
  const styles=await postcss([tailwind({config:path.join(root,'tailwind.config.ts')})]).process(fs.readFileSync('src/index.css','utf8'),{from:path.join(root,'src/index.css')})
  const css=styles.css+fs.readFileSync('src/components/shared/emptyState.css','utf8')
  const {CollectionEmptyState}=loadReportModule('../../components/shared/CollectionEmptyState.tsx')
  const button=React.createElement('button',{type:'button',className:'h-10 rounded-md bg-brand-orange px-4 text-white'},'Nuevo producto')
  const element=React.createElement('main',{className:'p-4 sm:p-8',style:{maxWidth:1200,margin:'auto'}},
    React.createElement('section',{id:'primary'},React.createElement(CollectionEmptyState,{title:'Luce vacío, ¿no?',description:'Agrega tu primer producto y empieza a organizar tu catálogo.',action:button})),
    React.createElement('div',{style:{overflowX:'auto'}},React.createElement('table',{style:{width:'100%',minWidth:1000}},React.createElement('tbody',null,React.createElement('tr',null,React.createElement('td',{id:'secondary',colSpan:4},React.createElement(CollectionEmptyState,{compact:true,title:'Cada cambio dejará su huella',description:'Las próximas acciones aparecerán aquí.',action:button})))))),
    React.createElement('section',{id:'filtered'},React.createElement(CollectionEmptyState,{compact:true,title:'No se usa',filtered:true,onReset(){},action:button})))
  let html=renderToStaticMarkup(element)
  html=html.replaceAll('/illustrations/empty-states/workspace-flat.png','data:image/png;base64,'+fs.readFileSync('public/illustrations/empty-states/workspace-flat.png').toString('base64'))
  const window=new BrowserWindow({show:false,width:1366,height:900,webPreferences:{sandbox:true,backgroundThrottling:false,offscreen:true}})
  await window.loadURL('about:blank')
  const document='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+html+'</body></html>'
  await window.webContents.executeJavaScript('document.open();document.write('+JSON.stringify(document)+');document.close();')
  await window.webContents.debugger.attach('1.3')
  for(const dark of [false,true])for(const width of [320,375,768,1366,1920]){
    await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
    const result=await window.webContents.executeJavaScript(`(async()=>{
      document.documentElement.classList.toggle('dark',${dark});await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>setTimeout(r,30));
      const primary=document.querySelector('#primary'),secondary=document.querySelector('#secondary'),filtered=document.querySelector('#filtered'),image=primary.querySelector('img'),r=image.getBoundingClientRect();
      const tableButton=secondary.querySelector('button').getBoundingClientRect();primary.querySelector('button').focus();return {fits:document.documentElement.scrollWidth<=innerWidth,primaryHeight:primary.getBoundingClientRect().height,secondaryImage:secondary.querySelector('img').getBoundingClientRect().height,tableActionVisible:tableButton.left>=0&&tableButton.right<=innerWidth,imageReady:image.complete&&image.naturalWidth===1536,imageWidth:r.width,imageHeight:r.height,filteredActions:filtered.querySelectorAll('button').length,filteredText:filtered.textContent,focused:document.activeElement===primary.querySelector('button'),surface:getComputedStyle(document.body).backgroundColor,text:getComputedStyle(primary).color};
    })()`)
    assert.ok(result.fits,'No horizontal overflow at '+width)
    assert.ok(result.tableActionVisible,'Empty table action visible without horizontal scrolling at '+width)
    assert.ok(result.imageReady,'The approved local image loads')
    assert.equal(result.imageWidth,180);assert.equal(result.imageHeight,120);assert.equal(result.secondaryImage,64)
    assert.ok(result.primaryHeight<420,'The primary empty state stays compact')
    assert.equal(result.filteredActions,1);assert.match(result.filteredText,/Limpiar filtros/);assert.doesNotMatch(result.filteredText,/Nuevo producto/)
    assert.ok(result.focused,'Action remains keyboard reachable')
    console.log('PASS empty '+(dark?'dark':'light')+' '+width+'px '+JSON.stringify(result))
    if(width===1366){const screenshot=await window.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('/tmp/auna-empty-'+(dark?'dark':'light')+'.png',Buffer.from(screenshot.data,'base64'))}
  }
  window.destroy()
}
app.whenReady().then(run).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1)})

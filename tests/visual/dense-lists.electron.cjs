// Offline geometry using the real private layout, controls and module styles; no application requests.
const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const { loadReportModule } = require('../helpers/loadReportModule.cjs')
const postcss = require('postcss'), tailwind = require('tailwindcss')
const root = path.resolve(__dirname, '../..')
process.chdir(root); app.disableHardwareAcceleration()

async function run() {
  console.log('Preparing dense-list geometry')
  const styles = await postcss([tailwind({ config:path.join(root,'tailwind.config.ts') })]).process(fs.readFileSync('src/index.css','utf8'), {from:path.join(root,'src/index.css')})
  const css = styles.css + ['components/shared/surfaces.css','components/shared/compactList.css','components/layout/pageNavigation.css','modules/inventory/products/productList.css','modules/contacts/pages/contactsList.css'].map(p=>fs.readFileSync('src/'+p,'utf8')).join('\n')
  const { SalesFilters } = loadReportModule('../sales/components/SalesFilters.tsx')
  const { Pagination } = loadReportModule('../../components/shared/Pagination.tsx')
  const rows = Array.from({length:50},(_,i)=>React.createElement('tr',{key:i},React.createElement('td',{style:{height:64}},'Registro '+i)))
  const table = React.createElement('table',{style:{minWidth:850,width:'100%'}},React.createElement('tbody',null,rows))
  const Results = () => React.createElement('section',{className:'auna-page-fluid inventory-products-page contacts-list p-4 sm:p-8'},
    React.createElement(SalesFilters,{searchTerm:'',onSearchChange(){},statusFilter:'all',onStatusChange(){},paymentFilter:'all',onPaymentChange(){},isGlobalSearch:true,paymentMethods:[]}),
    React.createElement('div',{className:'auna-data-table-shell overflow-x-auto'},React.createElement('div',{id:'products',className:'product-results-scroll'},table)),
    React.createElement('div',{id:'contacts',className:'contacts-table-scroll'},table),
    React.createElement('div',{id:'pager',className:'auna-pagination-outside'},React.createElement(Pagination,{currentPage:1,totalPages:3,totalItems:120,pageSize:50,count:50,itemLabel:'registros',onPageChange(){},onPageSizeChange(){}})))
  const provider = ({children})=>children
  const { MainLayout } = loadReportModule('../../components/layout/MainLayout.tsx',{
    './TopBar':{TopBar:()=>React.createElement('header',{className:'auna-topbar',style:{height:56}},'Auna')},
    '@/components/branding/DocumentBranding':{DocumentBranding:()=>null},
    '@/context/SystemSettingsContext':{SystemSettingsProvider:provider},
    '@/context/ModuleProvider':{ModuleProvider:provider},
    '@/routes/ModuleAccessBoundary':{ModuleAccessBoundary:Results},
    './PageNavigation':{PageNavigationProvider:provider},
  })
  const html = renderToStaticMarkup(React.createElement(MainLayout))
  console.log('Private layout rendered')
  const window = new BrowserWindow({show:false,width:1920,height:900,webPreferences:{sandbox:true,backgroundThrottling:false}})
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+html+'</body></html>'))
  console.log('Offline document loaded')
  await window.webContents.debugger.attach('1.3')
  for(const dark of [false,true]) for(const [width,height] of [[375,900],[375,480],[768,900],[1366,900],[1920,900],[1920,540]]) {
    await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    const result = await window.webContents.executeJavaScript(`(async()=>{
      document.documentElement.classList.toggle('dark',${dark});document.querySelector('#pager').className=${width>=1366 ? "'auna-surface-flat'" : "'auna-pagination-outside'"};const main=document.querySelector('.auna-app-content');main.scrollTop=0;
      await new Promise(r=>setTimeout(r,30));
      const products=document.querySelector('#products'),contacts=document.querySelector('#contacts');
      const unclipped=el=>el.scrollHeight<=el.clientHeight+1;
      const documentFits=document.documentElement.scrollHeight<=innerHeight+1;
      main.scrollTop=1800;await new Promise(r=>setTimeout(r,30));
      const filter=document.querySelector('.auna-list-toolbar, .compact-filter-toolbar').getBoundingClientRect(),footer=document.querySelector('footer').getBoundingClientRect(),bounds=main.getBoundingClientRect();
      const button=document.querySelector('footer button'),r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      main.scrollTop=main.scrollHeight;await new Promise(r=>setTimeout(r,30));
      const last=contacts.querySelector('tr:last-child').getBoundingClientRect(),endFooter=document.querySelector('footer').getBoundingClientRect();
      return {documentFits,mainScroll:main.scrollHeight>main.clientHeight,productsUnclipped:unclipped(products),contactsUnclipped:unclipped(contacts),horizontal:products.scrollWidth>products.clientWidth,
        filterTop:filter.top,filterBottom:filter.bottom,mainTop:bounds.top,mainBottom:bounds.bottom,footerTop:footer.top,footerBottom:footer.bottom,buttonReachable:!!hit?.closest('footer'),lastBottom:last.bottom,endFooterTop:endFooter.top};
    })()`)
    assert.ok(result.documentFits,'Only the application content scrolls vertically')
    assert.ok(result.mainScroll,'The full long list remains reachable in the main content')
    assert.ok(result.productsUnclipped && result.contactsUnclipped,'Principal tables have no clipped vertical scroller')
    assert.ok(result.filterTop>=result.mainTop-1 && result.filterTop<=result.mainTop+2,'Filters stay at the top of the content')
    assert.ok(result.footerBottom<=result.mainBottom+1 && result.footerTop>result.filterBottom,'Pagination remains visible without covering filters')
    assert.ok(result.buttonReachable,'Visible page controls accept pointer input')
    assert.ok(result.lastBottom<=result.endFooterTop+1,'The last row can scroll clear of the footer')
    if(width===375) assert.ok(result.horizontal,'Narrow tables retain local horizontal scrolling')
    console.log('PASS dense '+(dark?'dark':'light')+' '+width+'x'+height+'px')
  }
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'print'})
  const printable=await window.webContents.executeJavaScript(`(()=>{const main=document.querySelector('.auna-app-content');return main.scrollHeight<=main.clientHeight+1})()`)
  assert.ok(printable,'Native print layout does not clip the main content to one screen')
  window.destroy()
}
app.whenReady().then(run).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1)})

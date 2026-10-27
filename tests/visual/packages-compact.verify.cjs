// Run after generating packages-compact-preview.cjs and serving output/playwright on 127.0.0.1:4179.
const {execFileSync}=require('node:child_process'),path=require('node:path'),os=require('node:os')
const cli=path.join(os.homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh')
const verify=`async page => {
 await page.route('**/packages-compact-preview.js',route=>route.continue());
 const results=[];
 for(const mode of ['lista','nuevo','editar']){
  await page.goto('http://127.0.0.1:4179/packages-compact-preview.html?'+mode);
  if(mode==='lista')await page.getByRole('heading',{name:/Paquetes ·/}).waitFor();else await page.locator('#package-name').waitFor();
  for(const width of [375,768,1440]){
   await page.setViewportSize({width,height:1000});
   for(const dark of [false,true]){
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    await page.waitForTimeout(200);
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    if(layout.scroll>width)throw Error(mode+' horizontal overflow at '+width);
    const main=await page.locator('main').boundingBox();
    for(const item of await page.locator('.compact-filter-actions button,.compact-filter-actions a').all()){
     const box=await item.boundingBox();
     if(box&&(box.x<main.x||box.x+box.width>main.x+main.width))throw Error('Action clipped at '+width+': '+await item.textContent());
    }
    await page.screenshot({path:'output/playwright/inventory-final-'+mode+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
    results.push({mode,dark,...layout});
   }
  }
 }
 return results;
}`
process.stdout.write(execFileSync(cli,['--session','inventory-compact','run-code',verify],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))

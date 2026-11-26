// Run after generating packages-compact-preview.cjs and serving output/playwright on 127.0.0.1:4179.
const {execFileSync}=require('node:child_process'),path=require('node:path'),os=require('node:os')
const cli=path.join(os.homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh')
const verify=`async page => {
 await page.route('**/packages-compact-preview.js',route=>route.continue());
 const results=[];
 for(const mode of ['lista','nuevo','editar']){
  await page.goto('http://127.0.0.1:4179/packages-compact-preview.html?'+mode);
  if(mode==='lista')await page.getByRole('heading',{name:/Paquetes ·/}).waitFor();else await page.locator('#package-name').waitFor();
  for(const width of [375,768,1440,1920]){
   await page.setViewportSize({width,height:1000});
   for(const dark of [false,true]){
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    await page.waitForTimeout(200);
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    if(layout.scroll>width)throw Error(mode+' horizontal overflow at '+width);
    if(mode!=='lista'){
     const fields=[['#package-name',600],['#package-description',900],['input[id^="variant-"][id$="-name"]',540],['input[id^="variant-"][id$="-price"]',180]];
     for(const [selector,maxWidth] of fields){
      const box=await page.locator(selector).boundingBox();
      if(!box||box.width>maxWidth)throw Error(mode+' field too wide at '+width+': '+selector+' '+box?.width+' > '+maxWidth);
     }
     if(width>=768){
      const name=await page.locator('input[id^="variant-"][id$="-name"]').boundingBox();
      const price=await page.locator('input[id^="variant-"][id$="-price"]').boundingBox();
      if(price.x<=name.x||Math.abs(price.y-name.y)>2)throw Error(mode+' name and price should share a row at '+width);
     }
     if(width>=1536){
      const fixed=await page.getByRole('heading',{name:'Siempre incluye',exact:true}).boundingBox();
      const choices=await page.getByRole('heading',{name:'El cliente puede elegir',exact:true}).boundingBox();
      if(choices.x<=fixed.x||Math.abs(choices.y-fixed.y)>2)throw Error(mode+' composition sections should share a row at '+width);
     }
     if(width>=1280){
      const general=await page.getByRole('group',{name:'Datos generales',exact:true}).boundingBox();
      const description=await page.locator('#package-description').boundingBox();
      if(general.x+general.width-description.x-description.width>64)throw Error(mode+' excessive empty space beside general fields at '+width);
      const summary=await page.getByRole('complementary',{name:'Resumen del paquete'}).boundingBox();
      const name=await page.locator('#package-name').boundingBox();
      if(!summary||summary.x<=name.x+name.width||summary.y>name.y+100)throw Error(mode+' summary no longer alongside editable area');
     }
    }
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

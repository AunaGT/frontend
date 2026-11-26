const {execFileSync}=require('node:child_process')
const output=execFileSync('/home/DiegoPatzan/.codex/skills/playwright/scripts/playwright_cli.sh',['--session','auna-packages','run-code',`async page=>{
 await page.goto('http://127.0.0.1:4191/packages-catalog-preview.html');await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload();
 const layouts=[];
 for(const mode of ['cards','table']){
  await page.getByRole('tab',{name:mode==='cards'?'Tarjetas':'Tabla',exact:true}).click();
  for(const width of [375,1440])for(const dark of [false,true]){
   await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
   await page.getByRole('region',{name:mode==='cards'?'Tarjetas de paquetes':'Tabla de paquetes',exact:true}).waitFor();
   await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Page overflow '+mode+' '+width);
   if(mode==='cards'){
    const cards=await page.locator('.auna-record-card').count();if(!cards)throw Error('No shared inventory cards');
    const box=await page.locator('.auna-record-card').first().boundingBox();if(box.width>425||box.height>240)throw Error('Oversized package card');
   }else {if(!await page.locator('.auna-data-table tbody tr').count())throw Error('Empty table');if(await page.locator('.auna-data-table').evaluate(t=>t.scrollWidth<850))throw Error('Package table squeezes names instead of scrolling');}
   await page.screenshot({path:'output/playwright/packages-catalog-'+mode+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});layouts.push({mode,width,dark});
  }
 }
 const size=page.getByRole('combobox',{name:'Filas por página'});await size.selectOption('25');
 await page.waitForFunction(()=>window.__requests.at(-1).limit===25);await page.getByRole('region',{name:'Tabla de paquetes',exact:true}).waitFor();
 await page.getByRole('button',{name:'Página siguiente',exact:true}).click();await page.waitForFunction(()=>window.__requests.at(-1).cursor==='25');
 await page.getByRole('region',{name:'Tabla de paquetes',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Buscar paquetes'}).fill('Paquete de shots');await page.waitForFunction(()=>window.__requests.at(-1).q==='Paquete de shots'&&!window.__requests.at(-1).cursor);
 await page.getByRole('button',{name:'Vista previa de Paquete de shots',exact:true}).waitFor();await page.getByRole('button',{name:'Vista previa de Paquete de shots',exact:true}).click();
 await page.getByRole('heading',{name:'Paquete de shots',exact:true}).waitFor();if(await page.getByRole('dialog').count())throw Error('Preview is a modal');
 await page.getByRole('tab',{name:'Disponible al cotizar',exact:true}).click();await page.getByRole('heading',{name:'Paquete de shots · publicado',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:4191/packages-catalog-preview.html?mode=reader');await page.getByRole('button',{name:'Vista previa de Paquete de shots',exact:true}).waitFor();
 if(await page.getByRole('link',{name:'Nuevo paquete',exact:true}).count())throw Error('Reader sees create');
 if(await page.getByRole('button',{name:'Editar Paquete de shots',exact:true}).count())throw Error('Reader sees edit');
 await page.getByRole('button',{name:'Vista previa de Paquete de shots',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Paquete de shots',exact:true}).waitFor();
 if(await page.getByRole('button',{name:'Editar paquete',exact:true}).count())throw Error('Reader sees edit in detail');
 return {layouts:layouts.length,cardsAndTable:true,pageSize:true,cursorReset:true,previewPage:true,activeVersion:true,keyboard:true,readOnly:true};
}`],{encoding:'utf8',timeout:90000,maxBuffer:1024*1024})
if(output.includes('### Error')||!output.includes('"layouts":8'))throw Error(output)
console.log(output)

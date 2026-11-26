const {execFileSync}=require('node:child_process')
const result=execFileSync('/home/DiegoPatzan/.codex/skills/playwright/scripts/playwright_cli.sh',['--session','auna-cash6','run-code',`async page=>{
 const layouts=[];
 for(const mode of ['participant','owner','invited','empty']){
  await page.goto('http://127.0.0.1:4186/cash-shared-preview.html?mode='+mode);
  await page.getByRole('heading',{name:'Mi turno',exact:true}).waitFor();
  await page.getByRole('heading',{name:/Turnos en curso/}).waitFor();
  for(const width of [375,1440])for(const dark of [false,true]){
   await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow '+mode+' '+width);
   if(/Fondo inicial|Efectivo esperado/.test(await page.locator('main').innerText()))throw Error('Expected cash is visible');
   if(mode==='participant'&&await page.getByRole('button',{name:'Terminar turno',exact:true}).count())throw Error('Participant can finish');
   await page.screenshot({path:'output/playwright/cash6-'+mode+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});layouts.push({mode,width,dark});
  }
 }
 await page.goto('http://127.0.0.1:4186/cash-shared-preview.html?mode=participant');
 const disclosure=page.locator('summary').first();await disclosure.focus();await page.keyboard.press('Enter');
 if(!await page.getByText('Ana López, Luis Pérez',{exact:true}).first().isVisible())throw Error('Participant disclosure inaccessible');
 await page.goto('http://127.0.0.1:4186/cash-shared-preview.html?mode=invited');await page.getByRole('button',{name:'Unirme al turno',exact:true}).click();
 await page.getByRole('region',{name:/Turnos en curso/}).getByText(/Compartida · Participante/).waitFor();
 if(await page.evaluate(()=>window.__qaWrites)!==1)throw Error('Joining duplicated');
 await page.goto('http://127.0.0.1:4186/cash-shared-preview.html?mode=owner');await page.getByRole('button',{name:'Terminar turno',exact:true}).click();
 if(await page.getByRole('dialog').count())throw Error('Finishing moved into a modal');
 await page.getByRole('button',{name:'Confirmar fin de turno',exact:true}).evaluate(el=>{el.click();el.click()});
 await page.getByRole('heading',{name:/Turnos en curso/}).waitFor();
 if(await page.evaluate(()=>window.__qaWrites)!==1)throw Error('Finishing duplicated');
 return {layouts:layouts.length,keyboardDisclosure:true,joinOnce:true,finishOnce:true,noExpectedCash:true,noModal:true};
}`],{encoding:'utf8',timeout:90000,maxBuffer:1024*1024})
if(result.includes('### Error')||!result.includes('"layouts":16'))throw Error(result)
console.log(result)

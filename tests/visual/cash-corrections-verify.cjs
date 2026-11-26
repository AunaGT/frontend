const {execFileSync}=require('node:child_process'),fs=require('node:fs')
const result=execFileSync('/home/DiegoPatzan/.codex/skills/playwright/scripts/playwright_cli.sh',['--session','auna-corrections','run-code',`async page=>{
 const layouts=[];
 for(const mode of ['create','review','reader','blocked','consolidated']){
  await page.goto('http://127.0.0.1:4193/cash-corrections-preview.html?mode='+mode);
  await page.getByText(mode==='create'?'Importes correctos':'Se digitó Q900 en lugar de Q980. Conteo verificado.',{exact:true}).waitFor();
  for(const width of [375,1440])for(const dark of [false,true]){
   await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
   await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal page overflow '+mode+' '+width);
   if(['reader','consolidated'].includes(mode)&&await page.getByRole('button',{name:/^(Aprobar corrección|Rechazar|Cancelar propuesta)$/}).count())throw Error('Reader sees command');
   if(mode==='blocked'&&!await page.getByRole('button',{name:'Aprobar corrección'}).isDisabled())throw Error('Closed period approval enabled');
   await page.screenshot({path:'output/playwright/cash-correction-'+mode+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});layouts.push({mode,width,dark});
  }
 }
 await page.setViewportSize({width:1440,height:900});
 async function create(){await page.goto('http://127.0.0.1:4193/cash-corrections-preview.html?mode=create');await page.locator('#correction-amount-1').fill('980.00');await page.getByLabel('Motivo de la corrección *',{exact:true}).fill('Conteo verificado');}
 await create();
 if(await page.evaluate(()=>window.__requests.some(r=>r.isWrite)))throw Error('Typing caused a request');
 await page.getByRole('button',{name:'Revisar corrección',exact:true}).click();await page.getByRole('button',{name:'Enviar a revisión',exact:true}).waitFor();
 await page.evaluate(()=>window.__loseOnce=true);
 await page.getByRole('button',{name:'Enviar a revisión',exact:true}).click();await page.getByRole('alert').waitFor();
 if(await page.locator('#correction-amount-1').inputValue()!=='980.00')throw Error('Error lost inputs');
 await page.getByRole('button',{name:'Enviar a revisión',exact:true}).click();await page.getByRole('heading',{name:'Propuesta de corrección'}).waitFor();
 const keys=await page.evaluate(()=>window.__writes.map(w=>w.requestKey));if(keys.length!==2||keys[0]!==keys[1])throw Error('Retry lost command identity');
 await create();await page.evaluate(()=>window.__delay=180);await page.getByRole('button',{name:'Revisar corrección',exact:true}).click();
 await page.waitForFunction(()=>window.__requests.some(r=>r.path.endsWith('/preview')));
 await page.evaluate(()=>{window.__qa={...window.__qa,companyId:'company-B',actorId:'actor-B'};dispatchEvent(new Event('qa-context'))});
 await page.getByRole('rowheader',{name:'Efectivo · company-B Efectivo',exact:true}).waitFor();
 if(await page.getByRole('button',{name:'Enviar a revisión',exact:true}).count())throw Error('Late preview restored prior context');
 await page.goto('http://127.0.0.1:4193/cash-corrections-preview.html?mode=reader');await page.getByRole('button',{name:'Descargar PDF'}).waitFor();
 await page.evaluate(()=>{window.__qa={...window.__qa,denied:true,actorId:'no-access'};dispatchEvent(new Event('qa-context'))});
 await page.getByRole('alert').waitFor();if(await page.getByRole('button',{name:'Descargar PDF'}).count())throw Error('Denied context still exports');
 await create();await page.evaluate(()=>window.__qa.denied=true);await page.getByRole('button',{name:'Revisar corrección',exact:true}).click();await page.getByRole('alert').waitFor();
 if(await page.locator('#correction-amount-1').count())throw Error('Denied action retained sensitive form');
 return {layouts,typingRequests:0,retrySameKey:true,latePreviewIsolated:true,deniedPdfHidden:true,deniedActionClearsForm:true};
}`],{encoding:'utf8',maxBuffer:2*1024*1024})
fs.mkdirSync('output/qa/cash-corrections',{recursive:true});fs.writeFileSync('output/qa/cash-corrections/visual.log',result);console.log(result.slice(-4500))
if(result.includes('### Error'))process.exitCode=1

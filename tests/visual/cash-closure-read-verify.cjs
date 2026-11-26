const {execFileSync}=require('node:child_process')
const result=execFileSync('/home/DiegoPatzan/.codex/skills/playwright/scripts/playwright_cli.sh',['--session','auna-cashread','run-code',`async page=>{
 const layouts=[];
 for(const mode of ['cashier','auditor','supervisor','empty','error','detail','detail-denied']){
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});
  await page.goto('http://127.0.0.1:4191/cash-read-preview.html?mode='+mode);
  if(mode==='detail')await page.getByText('Mi turno · company-A',{exact:true}).waitFor();
  else if(mode==='detail-denied')await page.getByText('No se encontró el cierre solicitado.',{exact:true}).waitFor();
  else if(mode==='empty')await page.getByText('Aún no tienes arqueos',{exact:true}).waitFor();
  else if(mode==='error')await page.getByRole('alert').waitFor();
  else await page.getByRole('button',{name:'Arqueo #123',exact:true}).waitFor();
  for(const width of [375,1440])for(const dark of [false,true]){
   await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
   await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal page overflow '+mode+' '+width);
   if(mode==='cashier'&&await page.getByRole('tablist',{name:'Alcance de arqueos'}).count())throw Error('Cashier sees team selector');
   if(await page.getByRole('button',{name:/^(Aprobar|Finalizar|Pedir reconteo)$/}).count())throw Error('Reader sees review command');
   await page.screenshot({path:'output/playwright/cash-read-'+mode+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});layouts.push({mode,width,dark});
  }
 }
 await page.goto('http://127.0.0.1:4191/cash-read-preview.html?mode=auditor');await page.getByText('Equipo · company-A',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Mis arqueos',exact:true}).focus();await page.keyboard.press('Enter');await page.getByText('Mi turno · company-A',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Filtros de arqueos',exact:true}).click();await page.getByLabel('Desde',{exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Página siguiente',exact:true}).click();await page.getByRole('button',{name:'Arqueo #124',exact:true}).waitFor();
 await page.reload();await page.getByText('Equipo · company-A',{exact:true}).waitFor();
 await page.evaluate(()=>window.__qaDelay=450);await page.getByRole('button',{name:'Página siguiente',exact:true}).click();
 await page.waitForFunction(()=>window.__qaRequests.filter(r=>!r.path.includes('capabilities')).some(r=>!r.finished));
 await page.evaluate(()=>{window.__qaDelay=0;window.__qa={...window.__qa,companyId:'company-B',branchId:'branch-B',actorId:'user-B',mode:'cashier'};dispatchEvent(new Event('qa-context'));return new Promise(requestAnimationFrame)});
 if((await page.locator('#preview').innerText()).includes('company-A'))throw Error('Previous tenant visible during new context load');
 await page.getByText('Mi turno · company-B',{exact:true}).waitFor();
 await page.waitForFunction(()=>window.__qaRequests.every(r=>r.path.includes('capabilities')||r.finished));
 if((await page.locator('#preview').innerText()).includes('company-A'))throw Error('Stale response repopulated another tenant');
 if(await page.getByRole('tablist',{name:'Alcance de arqueos'}).count())throw Error('Revoked team authority still visible');
 await page.goto('http://127.0.0.1:4191/cash-read-preview.html?mode=detail');await page.getByText('Mi turno · company-A',{exact:true}).waitFor();
 await page.evaluate(()=>{window.__qa={...window.__qa,companyId:'company-B',branchId:'branch-B',actorId:'user-B',denied:true};dispatchEvent(new Event('qa-context'));return new Promise(requestAnimationFrame)});
 if((await page.locator('#preview').innerText()).includes('company-A'))throw Error('Detail retained previous tenant while loading');
 await page.getByText('No se encontró el cierre solicitado.',{exact:true}).waitFor();
 if(await page.getByRole('button',{name:/PDF/}).count())throw Error('Denied detail offers PDF');
 if(await page.evaluate(()=>window.__qaWrites)!==0)throw Error('Reading attempted a write');
 return {layouts:layouts.length,keyboard:true,pagination:true,contextIsolation:true,staleResponseIgnored:true,deniedDetailCleared:true,noWrites:true};
}`],{encoding:'utf8',timeout:90000,maxBuffer:1024*1024})
if(result.includes('### Error')||!result.includes('"layouts":28'))throw Error(result)
console.log(result)

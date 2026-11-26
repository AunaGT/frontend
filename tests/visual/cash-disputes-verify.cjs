const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process')
const base=process.argv[2],url=new URL(base)
if(url.hostname!=='127.0.0.1'||url.pathname!=='/disputes-preview.html')throw Error('Solo se verifica la vista local aislada de disputas')
const cli=path.join(os.homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh')
const code=`async(page)=>{
 const base=${JSON.stringify(base)},results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mode of ['list','detail','create','result','review','movement','accounting']){
  await page.goto(base+'?mode='+mode);
  if(mode==='list')await page.getByRole('link',{name:'CB-2026-0142'}).waitFor();
  else if(mode==='create')await page.locator('#dispute-reference').waitFor();
  else if(mode==='movement')await page.locator('#dispute-movement-principal').waitFor();
  else if(mode==='result')await page.getByRole('combobox',{name:'Resultado del reclamo'}).waitFor();
  else if(mode==='review')await page.getByText('Preparada por Andrea Gómez',{exact:false}).waitFor();
  else await page.getByRole('tab',{name:'Contabilidad',exact:true}).waitFor();
  if(mode==='accounting'){await page.getByRole('tab',{name:'Contabilidad',exact:true}).click();await page.getByText('Reclasificación contable del gasto a fondos en disputa.',{exact:false}).waitFor();if(await page.getByRole('link',{name:'Ver liquidación',exact:true}).count()!==2)throw Error('Faltan los documentos originales');}
  for(const width of [375,768,1440,1920]){await page.setViewportSize({width,height:900});for(const dark of [false,true]){
   if(mode==='accounting'&&width===375){const heading=await page.getByRole('heading',{level:1}).boundingBox();if(heading.width<180)throw Error('La acción comprime demasiado el título del expediente');}
   await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
   await page.screenshot({path:'output/qa/cash-disputes/'+mode+'-'+width+'-'+(dark?'dark':'light')+'-verified.png',fullPage:true,animations:'disabled'});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Desbordamiento '+mode+' '+width);results.push({mode,width,dark});
  }}
 }
 await page.goto(base+'?mode=accounting');await page.getByRole('tab',{name:'Contabilidad',exact:true}).click();await page.getByRole('link',{name:'Ver liquidación',exact:true}).first().waitFor();
 await page.evaluate(()=>{window.__qa={...window.__qa,settlementDenied:true};dispatchEvent(new Event('qa-context'))});
 await page.waitForFunction(()=>!document.querySelector('a[href*="/liquidaciones/"]'));
 await page.getByText('Reclasificación contable del gasto a fondos en disputa.',{exact:false}).waitFor();
 await page.goto(base+'?mode=create');await page.locator('#dispute-reference').waitFor();
 await page.locator('#dispute-reference').fill('CB-PRUEBA');await page.locator('#dispute-amount').fill('100.00');
 const before=await page.evaluate(()=>window.__requests.length);await page.locator('#dispute-reason').fill('Motivo conservado después de un error');
 if(await page.evaluate(()=>window.__requests.length)!==before)throw Error('Editar dispara consultas');
 await page.evaluate(()=>{window.__loseOnce=true});await page.getByRole('button',{name:'Registrar reclamo',exact:true}).click();
 await page.getByRole('alert').waitFor();if(await page.locator('#dispute-reason').inputValue()!=='Motivo conservado después de un error')throw Error('Se perdió el texto');
 await page.getByRole('button',{name:'Registrar reclamo',exact:true}).click();await page.getByRole('tab',{name:'Contabilidad',exact:true}).waitFor();
 const keys=await page.evaluate(()=>window.__writes.map(w=>w.requestKey));if(keys.length!==2||keys[0]!==keys[1])throw Error('Reintento sin la misma clave');
 await page.goto(base+'?mode=create');await page.locator('#dispute-reference').waitFor();await page.locator('#dispute-reference').fill('BORRADOR-ANTERIOR');
 await page.evaluate(()=>{window.__qa={...window.__qa,companyId:'company-B',branchId:'branch-B'};dispatchEvent(new Event('qa-context'))});
 await page.waitForFunction(()=>document.querySelector('#dispute-reference')?.value==='');
 await page.goto(base+'?mode=review');await page.getByRole('button',{name:'Aprobar propuesta',exact:true}).waitFor();
 await page.evaluate(()=>{window.__serverDenied=true});await page.getByRole('button',{name:'Aprobar propuesta',exact:true}).click();
 await page.waitForFunction(()=>!document.body.textContent.includes('CB-2026-0142'));
 await page.goto(base+'?mode=result');await page.getByRole('combobox',{name:'Resultado del reclamo'}).click();await page.getByRole('option',{name:'Resultado parcial',exact:true}).click();
 await page.locator('#dispute-won').fill('40.00');await page.locator('#dispute-lost').fill('60.00');await page.locator('#dispute-action-reason').fill('Resultado comunicado por el banco');
 await page.evaluate(()=>{window.__delay=300});await page.getByRole('button',{name:'Revisar efecto',exact:true}).click();
 if(await page.locator('#dispute-won').isEnabled())throw Error('Importe editable durante la revisión');
 await page.getByRole('button',{name:'Enviar a revisión',exact:true}).waitFor();await page.locator('#dispute-won').fill('30.00');
 await page.getByRole('button',{name:'Revisar efecto',exact:true}).waitFor();
 await page.goto(base+'?mode=create&readonly=1');await page.locator('#dispute-reference').waitFor();
 if(await page.locator('#dispute-reference').isEnabled())throw Error('Formulario editable con comandos cerrados');
 await page.goto(base+'?mode=movement');await page.locator('#dispute-movement-principal').waitFor();
 await page.getByRole('button',{name:'El proveedor lo retuvo',exact:false}).click();
 const movementReads=await page.evaluate(()=>window.__requests.length);
 await page.locator('#dispute-movement-principal').fill('20.00');await page.locator('#dispute-movement-reference').fill('RETENCION-20');
 if(await page.evaluate(()=>window.__requests.length)!==movementReads)throw Error('Editar el movimiento dispara consultas');
 await page.getByRole('button',{name:'Revisar movimiento',exact:true}).click();
 if(await page.getByRole('button',{name:'Confirmar movimiento',exact:true}).isEnabled())throw Error('Se permite confirmar sin revisar el soporte');
 for(const width of [375,768,1440,1920]){await page.setViewportSize({width,height:900});for(const dark of [false,true]){await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);await page.screenshot({path:'output/qa/cash-disputes/movement-review-'+width+'-'+(dark?'dark':'light')+'-verified.png',fullPage:true,animations:'disabled'});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Desbordamiento al revisar movimiento');results.push({mode:'movement-review',width,dark})}}
 await page.getByRole('checkbox').check();await page.evaluate(()=>{window.__loseOnce=true});await page.getByRole('button',{name:'Confirmar movimiento',exact:true}).click();
 await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Confirmar movimiento',exact:true}).click();await page.getByRole('tab',{name:'Contabilidad',exact:true}).waitFor();
 const attempts=await page.evaluate(()=>window.__writes);if(attempts.length!==2||attempts[0].requestKey!==attempts[1].requestKey||attempts[1].kind!=='PROVIDER_WITHHOLDING'||attempts[1].principal!=='20.00')throw Error('El reintento del movimiento perdió su identidad o importe');
 await page.goto(base+'?mode=movement');await page.locator('#dispute-movement-reference').fill('BORRADOR-OTRA-EMPRESA');await page.evaluate(()=>{window.__qa={...window.__qa,companyId:'company-B'};dispatchEvent(new Event('qa-context'))});await page.waitForFunction(()=>document.querySelector('#dispute-movement-reference')?.value==='');
 await page.goto(base+'?mode=movement&readonly=1');await page.locator('#dispute-movement-principal').waitFor();if(await page.locator('#dispute-movement-principal').isEnabled())throw Error('Movimiento editable con comandos cerrados');
 if(errors.length)throw Error(errors.join('; '));return {views:results.length,overflow:0,pageErrors:0,typingRequests:0,retryPreserved:true,contextCleared:true,revokedDataHidden:true,unavailableFormDisabled:true};
}`
const result=spawnSync(cli,['--session','auna-disputes-ui','run-code',code],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8',timeout:180000})
const output=(result.stdout||'')+(result.stderr||'')
const log=path.resolve(__dirname,'../../.superpowers/sdd/2026-11-22-cash-payment-disputes/screens-browser-verified.log')
fs.writeFileSync(log,output)
const failed=result.status!==0||!!result.error||output.includes('### Error')
console.log((!failed?output.split('### Ran Playwright code')[0]:output.slice(Math.max(0,output.indexOf('### Error')))).slice(0,2400))
if(result.error)console.log(result.error.message)
process.exitCode=failed?1:0

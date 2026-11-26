const { execFileSync } = require('node:child_process')
const cli = '/home/DiegoPatzan/.codex/skills/playwright/scripts/playwright_cli.sh'
const code = `async page => {
  const base='http://127.0.0.1:4183/cash-register-configuration-preview.html';
  await page.goto(base);await page.evaluate(()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('qa:cash3a:')||key.startsWith('auna:cash-configuration:'))sessionStorage.removeItem(key)});
  const results=[];
  for(const mode of ['edit','create','view','list']){
    await page.goto(base+'?mode='+mode);
    await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
    if(mode==='list')await page.getByText('Mostrador principal',{exact:true}).waitFor();else await page.locator('#cash-name').waitFor();
    for(const width of [375,768,1440])for(const dark of [false,true]){
      await page.setViewportSize({width,height:1000});await page.evaluate(value=>document.documentElement.classList.toggle('dark',value),dark);
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      if(layout.scroll>width)throw Error(mode+' overflows at '+width+': '+layout.scroll);
      if(mode!=='list'){
        const field=await page.locator('#cash-name').boundingBox();if(field.width>600)throw Error('Name input is too wide');
        if(width===1440&&mode!=='view'){
          const save=await page.getByRole('button',{name:mode==='create'?'Crear caja':'Guardar cambios',exact:true}).boundingBox();
          if(save.y+save.height>800)throw Error('Primary action below 800px: '+(save.y+save.height));
        }
      }
      if(width!==768)await page.screenshot({path:'output/playwright/cash-configuration-'+mode+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
      results.push({mode,width,dark});
    }
  }
  await page.goto(base+'?mode=create');await page.locator('#cash-name').waitFor();
  await page.getByRole('button',{name:'Crear caja',exact:true}).click();
  if(await page.evaluate(()=>document.activeElement.id)!=='cash-name')throw Error('Invalid submit did not focus first field');
  if(await page.locator('#cash-name').getAttribute('aria-invalid')!=='true')throw Error('Missing inline validation');
  await page.locator('#cash-name').fill('Caja QA');await page.locator('#cash-code').fill('QA-01');
  await page.getByRole('checkbox',{name:'Luis Pérez',exact:true}).check();
  await page.getByRole('button',{name:'Página siguiente',exact:true}).click();await page.getByRole('checkbox',{name:'Persona del equipo 20',exact:true}).waitFor();
  if(!await page.getByRole('button',{name:'Quitar Luis Pérez',exact:true}).isVisible())throw Error('Changing page lost selected person');
  return {layouts:results.length,validation:true,paginationSelection:true};
}`
function command(...args) {
  const result = execFileSync(cli, ['--session', 'auna-cash3a', ...args], { encoding: 'utf8', timeout: 90000, maxBuffer: 1024*1024, env: { ...process.env, npm_config_loglevel: 'error' } })
  if (result.includes('### Error')) throw Error(result)
  return result
}
function navigate(...args) {
  const result = command(...args)
  if (result.includes('### Modal state')) command('dialog-accept')
}
command('close'); command('open','http://127.0.0.1:4183/cash-register-configuration-preview.html')
const result = command('run-code', code)
if (!/### Result[\s\S]*"layouts":\s*24/.test(result)) throw Error('La comprobación visual no terminó: '+result)
navigate('reload')
command('run-code', `async page => {await page.locator('#cash-name').waitFor();if(await page.locator('#cash-name').inputValue()!=='Caja QA')throw Error('Draft did not survive reload');return {reloadDraft:true}}`)
navigate('goto','http://127.0.0.1:4183/cash-register-configuration-preview.html?mode=edit&lost=1')
command('run-code', `async page => {
  await page.locator('#cash-name').waitFor();
  await page.locator('#cash-name').fill('Guardado con respuesta perdida');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await page.getByRole('button',{name:'Recuperar guardado',exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.setItem('qa:cash3a:original',JSON.stringify(window.__qaRequests.find(r=>r.body)?.body)));
  return {lostResponse:true};
}`)
navigate('reload')
const recovered = command('run-code', `async page => {
  await page.getByRole('button',{name:'Recuperar guardado',exact:true}).waitFor();
  await page.evaluate(()=>window.__qaDeny=true);await page.getByRole('button',{name:'Recuperar guardado',exact:true}).click();
  await page.getByText('Permiso de prueba revocado',{exact:true}).waitFor();
  if(!await page.locator('#cash-name').isDisabled())throw Error('Uncertain recovery allowed editing');
  const retried=await page.evaluate(()=>window.__qaRequests.find(r=>r.body)?.body);
  const original=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa:cash3a:original')));
  if(JSON.stringify(retried)!==JSON.stringify(original))throw Error('Recovery changed the request');
  await page.evaluate(()=>window.__qaDeny=false);await page.getByRole('button',{name:'Recuperar guardado',exact:true}).click();
  await page.getByText('Configuración guardada.',{exact:false}).waitFor();
  if(await page.locator('#cash-name').isDisabled())throw Error('Confirmed receipt did not unlock editing');
  return {lostResponse403Recovery:true};
}`)
navigate('goto','http://127.0.0.1:4183/cash-register-configuration-preview.html?mode=edit&unavailable=1')
command('run-code', `async page => {
  await page.getByRole('heading',{name:'La configuración avanzada aún no está disponible'}).waitFor();
  if(await page.getByRole('button',{name:'Guardar cambios',exact:true}).count())throw Error('Unavailable schema showed a false save action');
  return {unavailable:true};
}`)
if (!/### Result[\s\S]*"lostResponse403Recovery":\s*true/.test(recovered)) throw Error('La recuperación no terminó: '+recovered)
console.log(JSON.stringify({ layouts: 24, validation: true, paginationSelection: true, reloadDraft: true, lostResponse403Recovery: true, unavailable: true }))

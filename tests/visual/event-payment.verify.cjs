const {execFileSync}=require('node:child_process'),path=require('node:path'),os=require('node:os')
const cli=path.join(os.homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh')
const verify=`async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4179/event-payment-preview.html');
 await page.getByRole('heading',{name:'Acuerdo de servicio · ejemplo'}).waitFor();
 if(await page.getByLabel('Anticipo (%)',{exact:true}).count())throw Error('Disabled agreement expanded');
 await page.getByRole('switch',{name:'Anticipo y saldo para servicios',exact:true}).focus();await page.keyboard.press('Space');
 await page.getByRole('button',{name:'Revisar acuerdo de ejemplo',exact:true}).click();
 const percent=page.getByLabel('Anticipo (%)',{exact:true});
 if(!await percent.evaluate(el=>document.activeElement===el))throw Error('First invalid field not focused');
 if(await percent.inputValue()!=='')throw Error('Invented percentage');
 await percent.fill('25');await page.getByLabel('Saldo: días antes',{exact:true}).fill('3');await page.getByLabel('Primera prestación prevista',{exact:true}).fill('2027-01-10T10:00');
 await page.getByRole('button',{name:'Revisar acuerdo de ejemplo',exact:true}).click();
 if(!await page.getByText('Acuerdo revisado',{exact:true}).count())throw Error('Valid agreement not retained');
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});for(const dark of [false,true]){
  await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow '+width);
  const box=await percent.boundingBox();if(box.width>150)throw Error('Stretched percent '+box.width);
  await page.screenshot({path:'output/playwright/payment-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
 }}
 await page.getByRole('button',{name:'Revisar cambio de fechas',exact:true}).click();await page.getByRole('alertdialog').waitFor();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 if(await page.getByText('Fechas aceptadas en el ejemplo',{exact:true}).count())throw Error('Cancellation accepted review');
 await page.getByRole('button',{name:'Revisar cambio de fechas',exact:true}).click();await page.getByRole('button',{name:'Aceptar fechas y guardar',exact:true}).click();
 if(!await page.getByText('Fechas aceptadas en el ejemplo',{exact:true}).count())throw Error('Explicit consent missing');
 if(errors.length)throw Error(errors.join('; '));return {viewports:6,noOverflow:true,keyboardOptIn:true,errorFocus:true,reviewCancelAndConfirm:true,pageErrors:0};
}`
process.stdout.write(execFileSync(cli,['-s=payment-2c','run-code',verify],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8',timeout:60000}))

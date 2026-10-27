const {execFileSync}=require('node:child_process'),path=require('node:path'),os=require('node:os')
const cli=path.join(os.homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh')
const verify=`async page=>{
 const results=[];
 await page.goto('http://127.0.0.1:4179/operational-timeline-preview.html');
 await page.getByRole('heading',{name:'Programar evento de ejemplo'}).waitFor();
 await page.getByRole('button',{name:'Agregar momento',exact:true}).click();
 const name=page.getByLabel('Nombre del momento *',{exact:true}).last();
 if(!await name.evaluate(el=>document.activeElement===el))throw Error('New moment did not receive focus');
 await name.fill('Atención principal');
 if(await page.getByLabel('Nombre del momento *',{exact:true}).count()!==2)throw Error('Adding lost previous moments');
 await page.getByRole('button',{name:'Quitar momento Atención principal',exact:true}).click();
 await page.getByRole('combobox',{name:'Horario de Equipo de sonido',exact:true}).click();
 await page.getByRole('option',{name:'Horario propio',exact:true}).click();
 const checks=page.getByRole('checkbox',{name:'Revisé el traslado y la preparación de este horario',exact:true});
 if(await checks.last().isChecked())throw Error('Custom logistics were silently accepted');
 await checks.last().check();
 await page.getByRole('combobox',{name:'Horario de Equipo de sonido',exact:true}).click();
 await page.getByRole('option',{name:'Todo el evento',exact:true}).click();
 for(const width of [375,768,1440]){
  await page.setViewportSize({width,height:1000});
  for(const dark of [false,true]){
   await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
   await page.emulateMedia({reducedMotion:'reduce'});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow '+width);
   const box=await page.getByRole('combobox',{name:'Horario de Artista de bienvenida'}).boundingBox();
   if(width>=768&&box.width>185)throw Error('Attendance selector stretched '+box.width);
   const field=await page.locator('#moment-m1-name').boundingBox();
   if(field.width>520)throw Error('Name stretched '+field.width);
   await page.screenshot({path:'output/playwright/timeline-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
   results.push({width,dark,noOverflow:true});
  }
 }
 await page.getByRole('button',{name:'Alternar solo lectura',exact:true}).click();
 if(!await page.getByRole('button',{name:'Agregar momento',exact:true}).isDisabled())throw Error('Read-only edit enabled');
 if(!await page.getByRole('combobox',{name:'Horario de Artista de bienvenida'}).isDisabled())throw Error('Read-only select enabled');
 return {cases:results.length,results,focus:true,marginReview:true,readOnly:true};
}`
process.stdout.write(execFileSync(cli,['-s=timeline-2b','run-code',verify],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8',timeout:60000}))

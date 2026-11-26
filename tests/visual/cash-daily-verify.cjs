const {execFileSync}=require('node:child_process')
const cli='/home/DiegoPatzan/.codex/skills/playwright/scripts/playwright_cli.sh'
const result=execFileSync(cli,['--session','auna-cash51','run-code',`async page=>{
  const results=[];
  for(const mode of ['finalized','provisional','legacy']){
    await page.goto('http://127.0.0.1:4185/cash-daily-preview.html?mode='+mode);
    await page.getByRole('heading',{name:'Efectivo del día',exact:true}).waitFor();
    await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
    for(const width of [375,768,1440])for(const dark of [false,true]){
      await page.setViewportSize({width,height:1000});await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error(mode+' horizontal overflow '+width);
      const digital=page.getByRole('region',{name:'Digital del día operativo',exact:true});if((await digital.innerText()).includes('999.00'))throw Error('Live notice mixed with confirmed money');
      if(mode==='legacy'&&!await page.getByText(/Formato anterior/).isVisible())throw Error('Legacy label absent');
      if(mode==='finalized'&&await page.getByRole('button',{name:'Finalizar día',exact:true}).count())throw Error('Frozen day offers finalize');
      if(mode==='provisional'&&width===1440){const b=await page.getByRole('button',{name:'Finalizar día',exact:true}).boundingBox();if(b.y+b.height>800)throw Error('Primary action below fold')}
      if(width!==768)await page.screenshot({path:'output/playwright/cash51-'+mode+'-'+width+'-'+(dark?'dark':'light')+'.png',fullPage:true});
      results.push({mode,width,dark});
    }
  }
  await page.goto('http://127.0.0.1:4185/cash-daily-preview.html');await page.getByRole('heading',{name:'Efectivo del día',exact:true}).waitFor();
  const summary=page.locator('summary').filter({hasText:'Movimientos internos y origen de fondos'});await summary.focus();await page.keyboard.press('Enter');if(!await page.getByText('Heredado de otros días',{exact:true}).isVisible())throw Error('Keyboard cannot reveal provenance');
  return {layouts:results.length,keyboardDisclosure:true,separateLiveRegion:true};
}`],{encoding:'utf8',timeout:90000,maxBuffer:1024*1024})
if(result.includes('### Error')||!/### Result\s*\{[^\n]*"layouts":\s*18/.test(result))throw Error(result)
console.log(result)

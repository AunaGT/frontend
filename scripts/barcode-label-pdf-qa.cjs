const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {preparedLabelFixture,withLabelPdf}=require('../tests/helpers/barcodePdfHarness.cjs'),{labelProduct}=require('../tests/fixtures/barcodeLabelFixtures.cjs')
async function main(){
  const arg=process.argv.indexOf('--out'),output=arg>=0?path.resolve(process.argv[arg+1]||''):path.resolve(__dirname,'../output/pdf');if(arg>=0&&!process.argv[arg+1])throw Error('Indica una carpeta de salida');fs.mkdirSync(output,{recursive:true})
  await withLabelPdf(async({generateBarcodeLabelPdf})=>{
    for(const format of ['letter','a4','legal','custom']){
      const prepared=preparedLabelFixture({products:[labelProduct({id:'a',name:'Café de especialidad',barcode:'AUNA0123456789AB',copies:32}),labelProduct({id:'b',name:'Agua mineral botella',barcode:'AUNA9876543210AB',copies:3}),labelProduct({id:'c',name:'Chocolate artesanal',barcode:'AUNA111122223333',copies:1})],paperOverride:{format,...(format==='custom'?{widthMm:170,heightMm:100}:{} )}})
      prepared.companyName='Auna - Empresa de demostración';prepared.design.heightMm=35
      if(format!=='custom'){
        const sizes={letter:[215.9,279.4],a4:[210,297],legal:[215.9,355.6]};[prepared.paper.widthMm,prepared.paper.heightMm]=sizes[format]
      }
      const result=await generateBarcodeLabelPdf(prepared),file=path.join(output,`ejemplo-etiquetas-${format}.pdf`);fs.writeFileSync(file,Buffer.from(await result.labels.arrayBuffer()))
      assert.equal(result.plan.ranges.length,3);assert.equal(result.plan.ranges[0].firstPage,2);assert.equal(result.plan.labelPages.flatMap(p=>p.products).length,36)
      process.stdout.write(`${file}: ${result.plan.totalPages} páginas; rangos ${JSON.stringify(result.plan.ranges)}\n`)
    }
  })
}
main().catch(e=>{process.stderr.write(`${e.stack}\n`);process.exitCode=1})

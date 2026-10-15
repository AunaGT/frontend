const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process')
const {preparedLabelFixture,withLabelPdf}=require('./helpers/barcodePdfHarness.cjs')
test('real PDF renders decodable symbols and exact-size thermal pages for all four types',()=>withLabelPdf(async({generateBarcodeLabelPdf})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'auna-barcode-pdf-'))
  for(const [type,barcode]of [['code128','AUNA123456789ABC'],['ean13','4006381333931'],['ean8','96385074'],['upca','012345000058']]){
    const fixture=preparedLabelFixture({type,barcode,thermal:true,copies:2}),result=await generateBarcodeLabelPdf(fixture),file=path.join(dir,type+'.pdf'),prefix=path.join(dir,type)
    fs.writeFileSync(file,Buffer.from(await result.labels.arrayBuffer()))
    assert.equal(result.plan.labelPages.length,2);assert.ok(result.guide)
    const info=spawnSync('pdfinfo',[file],{encoding:'utf8'});assert.equal(info.status,0);assert.match(info.stdout,/Pages:\s+2/);assert.match(info.stdout,/198\.425 x 170\.079 pts/)
    const render=spawnSync('pdftoppm',['-f','1','-l','1','-r','300','-singlefile','-png',file,prefix]);assert.equal(render.status,0,render.stderr.toString())
    const scan=spawnSync('zbarimg',['--quiet','--raw',prefix+'.png'],{encoding:'utf8'});assert.equal(scan.status,0,scan.stderr)
    const actual=scan.stdout.trim().split('\n');assert.ok(actual.includes(barcode)||type==='upca'&&actual.includes('0'+barcode),`${type}: ${scan.stdout}`)
  }
  console.log('Barcode PDF QA: '+dir)
}))

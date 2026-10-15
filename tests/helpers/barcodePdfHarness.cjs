const fs=require('node:fs'),path=require('node:path'),{loadReportModule}=require('./loadReportModule.cjs')
const {labelProduct}=require('../fixtures/barcodeLabelFixtures.cjs')
function preparedLabelFixture({type='code128',barcode='AUNA123456789ABC',thermal=false,copies=1,guide=true,paperOverride={},products}={}){
  const {createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts')
  const design=createLabelTemplate('product');design.heightMm=60;design.barcodeType=type
  return{id:'qa',companyId:'qa',actorId:'qa',companyName:'Empresa QA',currencyCode:'GTQ',locale:'es-GT',timezone:'America/Guatemala',createdAt:'2026-10-14T18:00:00Z',scope:{branchId:'qa',inBranch:false},products:products||[labelProduct({barcode,copies})],design,paper:{...defaultPaper(),...(thermal?{format:'thermal'}:{}),includeGuide:guide,...paperOverride},assignedProductIds:[]}
}
async function withLabelPdf(run){
  const old=global.fetch
  global.fetch=async url=>{if(typeof url!=='string'||!url.startsWith('/fonts/'))throw Error('Unexpected QA font URL');const file=path.join(__dirname,'../../public',url);return{ok:fs.existsSync(file),arrayBuffer:async()=>{const b=fs.readFileSync(file);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}}}
  try{return await run(loadReportModule('../inventory/barcodeLabels/labelPdf.ts'))}finally{global.fetch=old}
}
module.exports={preparedLabelFixture,withLabelPdf}

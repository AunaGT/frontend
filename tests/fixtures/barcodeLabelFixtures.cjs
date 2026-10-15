const {loadReportModule}=require('../helpers/loadReportModule.cjs')
const {createLabelTemplate,defaultPaper}=loadReportModule('../inventory/barcodeLabels/labelDesign.ts')
const labelProduct=(overrides={})=>({id:'11111111-1111-4111-8111-111111111111',name:'Producto QA',barcode:'012345000058',price:'25.00',copies:1,brand:null,size:null,...overrides})
const printInput=(overrides={})=>({requestKey:'22222222-2222-4222-8222-222222222222',scope:{branchId:'33333333-3333-4333-8333-333333333333',inBranch:false},items:[{productId:labelProduct().id,copies:1,expectedBarcode:labelProduct().barcode,assignment:{mode:'keep'}}],design:createLabelTemplate('product'),paper:defaultPaper(),confirmAssignments:false,...overrides})
module.exports={labelProduct,printInput}

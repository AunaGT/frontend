const {loadReportModule}=require('../helpers/loadReportModule.cjs')
function makeCouponFixture(){return{design:loadReportModule('../promotions/coupons/couponDesign.ts').createDefaultCouponDesign(),promotion:{name:'Promoción QA',description:'Beneficio para clientes',type:{name:'PERCENTAGE'},discount_percentage:15,start_date:'2026-10-11',applies_to_all_branches:true,active:true},codes:[{id:1,code:'CUPON-QA',active:true,current_uses:0}],branding:{companyName:'Empresa QA',locale:'es-GT',currencyCode:'GTQ',timezone:'America/Guatemala'},assets:new Map()}}
module.exports={makeCouponFixture}

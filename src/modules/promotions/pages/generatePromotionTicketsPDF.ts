import {buildCouponPdf} from '../coupons/couponPdf'
import {createDefaultCouponDesign,type CouponDesign} from '../coupons/couponDesign'
import type {CouponPromotion,CouponCode} from '../coupons/couponPresentation'
import type {CouponAssets} from '../coupons/CouponCanvas'
interface TicketOptions{codes:CouponCode[];printCode?:boolean;promotion:CouponPromotion;terms?:string;design?:CouponDesign;assets?:CouponAssets;logoBase64?:string;locale?:string;currencyCode?:string;companyName?:string;timezone?:string;signal?:AbortSignal}
export async function generatePromotionTicketsPDF(options:TicketOptions):Promise<void>{
  const design=options.design||options.promotion.coupon_design||createDefaultCouponDesign()
  const blob=await buildCouponPdf({design:options.terms===undefined?design:{...design,terms:options.terms},promotion:options.promotion,codes:options.codes,printCode:options.printCode,branding:{companyName:options.companyName||'',logoDataUrl:options.logoBase64,locale:options.locale||'es-GT',currencyCode:options.currencyCode||'GTQ',timezone:options.timezone||'America/Guatemala'},assets:options.assets||new Map(),signal:options.signal})
  if(options.signal?.aborted)throw Error('Exportación cancelada por cambio de contexto')
  const url=URL.createObjectURL(blob),link=document.createElement('a')
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:options.timezone||'America/Guatemala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  link.href=url;link.download='Tickets_'+options.promotion.name.replace(/[^a-z0-9_-]/gi,'_')+'_'+date+'.pdf'
  try{document.body.appendChild(link);link.click()}finally{link.remove();URL.revokeObjectURL(url)}
}

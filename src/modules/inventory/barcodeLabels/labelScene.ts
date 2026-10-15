import {parseLabelDesign} from './labelDesign'
import {encodeLabelBarcode} from './barcodeEncoding'
import type {LabelDesign,LabelProduct,TextStyle,LabelField,PriceTier,LabelCandidate} from './types'
import type {CouponMeasure} from '@/modules/promotions/coupons/couponPresentation'
export type SceneText={kind:'text';id:string;x:number;y:number;width:number;height:number;lines:string[];style:TextStyle}
export type SceneBarcode={kind:'barcode';id:string;x:number;y:number;width:number;height:number;bars:{x:number;y:number;width:number;height:number}[]}
export type SceneShape={kind:'shape';id:string;x:number;y:number;width:number;height:number;shape:'rect'|'line'|'ellipse';color:string;borderColor:string;borderWidth:number}
export type LabelScene={widthMm:number;heightMm:number;nodes:(SceneText|SceneBarcode|SceneShape)[]}
export const PT_MM=25.4/72
export function wrapLabelText(text:string,widthMm:number,style:TextStyle,measure:CouponMeasure):string[]{
  if(measure.supports&&!measure.supports(text,style))throw Error('La fuente no incluye todos los caracteres del texto')
  const fits=(s:string)=>measure(s,style)*PT_MM<=widthMm+1e-7
  const lines:string[]=[]
  for(const paragraph of text.split('\n')){
    let line=''
    for(const word of paragraph.split(/\s+/)){
      if(!word)continue
      if(fits(line?line+' '+word:word)){line=line?line+' '+word:word;continue}
      if(line){lines.push(line);line=''}
      for(const char of word){if(!fits(char))throw Error('El texto no cabe en este ancho');if(line&&!fits(line+char)){lines.push(line);line=''}line+=char}
    }
    lines.push(line)
  }
  return lines
}
export function shelfPreviewProduct(product:LabelCandidate,design:LabelDesign,tiers:PriceTier[]=design.priceTiers||['LIST']):LabelProduct{
  const prices=(product.shelfPrices||[]).filter(p=>tiers.includes(p.tier)&&(p.tier!=='PROMOTION'||!product.promotionValidUntil||new Date(product.promotionValidUntil).getTime()>=Date.now()))
  prices.sort((a,b)=>(a.tier===design.primaryTier?-1:0)-(b.tier===design.primaryTier?-1:0))
  return{...product,barcode:product.barcode||'',copies:1,shelfPrices:prices}
}
export function prepareLabelScene(product:LabelProduct,raw:LabelDesign,measure:CouponMeasure,branding:{companyName:string;currencyCode:string;locale:string;timezone?:string}):LabelScene{
  const design=parseLabelDesign(raw),nodes:LabelScene['nodes']=[]
  const shelf=design.purpose==='shelf',prices=product.shelfPrices||[],slotFields=['price','price_secondary','price_tertiary']
  const money=(amount:string)=>new Intl.NumberFormat(branding.locale,{style:'currency',currency:branding.currencyCode}).format(Number(amount))
  const values:Partial<Record<LabelField,string>>={name:product.name,barcode:product.barcode,brand:product.brand||'',size:product.size||'',company:branding.companyName,price:money(shelf?prices[0]?.amount||product.price:product.price)}
  if(shelf){
    if(!prices.length)throw Object.assign(Error(`${product.name}: no hay tarifas seleccionadas disponibles`),{productId:product.id})
    prices.forEach((price,index)=>{const field=slotFields[index] as LabelField;values[field]=money(price.amount);values[(index===0?'price_label':field+'_label') as LabelField]=price.label;if(!design.elements.some(e=>e.kind==='field'&&e.field===field&&e.visible))throw Object.assign(Error(`${product.name}: agrega o muestra el campo del precio ${index+1} en el diseño`),{productId:product.id,field})})
    values.promotion_until=prices.some(p=>p.tier==='PROMOTION')&&product.promotionValidUntil?`Promoción hasta ${new Date(product.promotionValidUntil).toLocaleString(branding.locale,{timeZone:branding.timezone||'America/Guatemala',dateStyle:'short',timeStyle:'short'})}`:''
  }
  for(const e of design.elements){
    if(!e.visible)continue
    if(shelf&&((e.kind==='barcode'||e.kind==='field'&&e.field==='barcode')&&!product.barcode||e.kind==='field'&&(!values[e.field]&&e.field!=='name')))continue
    const box={id:e.id,x:e.x*design.widthMm,y:e.y*design.heightMm,width:e.width*design.widthMm,height:e.height*design.heightMm}
    try{
      if(e.kind==='barcode'){nodes.push({...box,kind:'barcode',bars:encodeLabelBarcode(product.barcode,design.barcodeType,box).bars});continue}
      if(e.kind==='shape'){nodes.push({...box,kind:'shape',shape:e.shape,color:e.color,borderColor:e.borderColor,borderWidth:e.borderWidth});continue}
      const value=e.kind==='text'?e.text:values[e.field]||''
      const style=e.style,text=style.uppercase?value.toLocaleUpperCase(branding.locale):value,pad=style.padding*PT_MM,width=box.width-2*pad
      const lines=e.kind==='field'&&e.field==='barcode'?[text]:wrapLabelText(text,width,style,measure)
      if(measure.supports&&!measure.supports(text,style))throw Error('La fuente no incluye todos los caracteres del texto')
      if(lines.some(line=>measure(line,style)*PT_MM>width+1e-7)||lines.length*style.fontSize*style.lineHeight*PT_MM>box.height-2*pad+1e-7)throw Error('El texto no cabe: amplía la capa o reduce la fuente')
      nodes.push({...box,kind:'text',lines,style})
    }catch(error){throw Object.assign(new Error(`${product.name} · ${e.id}: ${error instanceof Error?error.message:'Revisa la etiqueta'}`),{productId:product.id,field:e.id})}
  }
  return{widthMm:design.widthMm,heightMm:design.heightMm,nodes}
}

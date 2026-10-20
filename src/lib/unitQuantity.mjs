import { normalizeQuantityInput } from './commercialQuantity.mjs'

const power=places=>10n**BigInt(places)
function parts(raw,decimals=6){
  if(typeof raw!=='string'||raw.length>128||!/^\d+(?:[.,]\d+)?$/.test(raw.trim()))throw new Error('Ingresa una cantidad válida')
  const [whole,fraction='']=raw.trim().replace(',','.').split('.')
  const significant=fraction.replace(/0+$/,'')
  if(!Number.isInteger(decimals)||decimals<0||decimals>18||significant.length>decimals)throw new Error(`Usa hasta ${decimals} decimales`)
  return {ticks:BigInt(whole)*power(decimals)+BigInt(significant.padEnd(decimals,'0')||'0'),decimals}
}
function fromTicks(ticks,decimals){
  const sign=ticks<0n?'-':'';ticks=ticks<0n?-ticks:ticks
  const whole=ticks/power(decimals),fraction=(ticks%power(decimals)).toString().padStart(decimals,'0').replace(/0+$/,'')
  return `${sign}${whole}${fraction?'.'+fraction:''}`
}
export function normalizeUnitDecimal(raw,{decimals=6,max='99999999.999999',allowZero=true}={}){
  const {ticks}=parts(raw,decimals)
  const ceiling=parts(max,Math.max(decimals,(max.split('.')[1]||'').length))
  if(ticks*power(ceiling.decimals)>ceiling.ticks*power(decimals))throw new Error('Cantidad fuera de rango')
  if(!allowZero&&ticks===0n)throw new Error('La cantidad debe ser mayor a cero')
  return fromTicks(ticks,decimals)
}
export function normalizeProductQuantity(raw,rules,locale='es-GT'){
  const decimals=rules.kind==='KIT'?0:rules.kind==='SERVICE'?Math.min(4,rules.quantityDecimals):rules.advanced?rules.quantityDecimals:0
  const normalized=normalizeUnitDecimal(raw,{decimals})
  // Keep the established service contract on its existing exact quantity implementation.
  if(!rules.advanced&&rules.kind==='SERVICE'&&normalized!=='0')return normalizeQuantityInput(normalized,{kind:'SERVICE',quantityDecimals:decimals},locale)
  return normalized
}
export function convertUnitQuantity(raw,factor,baseDecimals=0){
  const qty=parts(normalizeUnitDecimal(raw,{decimals:6,allowZero:false}),6)
  const f=parts(normalizeUnitDecimal(factor,{decimals:12,max:'99999999.999999999999',allowZero:false}),12)
  if(!Number.isInteger(baseDecimals)||baseDecimals<0||baseDecimals>6)throw new Error('Precisión base inválida')
  const exact=qty.ticks*f.ticks,divisor=power(18-baseDecimals)
  if(baseDecimals===0&&exact%divisor)throw new Error('La unidad base es indivisible; usa una cantidad entera')
  const accepted=(exact+divisor/2n)/divisor
  const baseQty=normalizeUnitDecimal(fromTicks(accepted,baseDecimals),{decimals:baseDecimals})
  return {baseQty,exactBaseQty:fromTicks(exact,18),roundingDelta:fromTicks(accepted*divisor-exact,18),roundingRequired:exact%divisor!==0n}
}
export function deriveUnitPrice(price,factor){
  const p=parts(normalizeUnitDecimal(price,{decimals:6,max:'9999999999.99'}),6)
  const f=parts(normalizeUnitDecimal(factor,{decimals:12,max:'99999999.999999999999',allowZero:false}),12)
  return normalizeUnitDecimal(fromTicks(p.ticks*f.ticks,18),{decimals:18,max:'9999999999.99'})
}
export function deriveMeasureFactor(measureFactor,baseFactor){
  const measure=parts(normalizeUnitDecimal(measureFactor,{decimals:12,max:'99999999.999999999999',allowZero:false}),12).ticks
  const base=parts(normalizeUnitDecimal(baseFactor,{decimals:12,max:'99999999.999999999999',allowZero:false}),12).ticks
  if(measure*power(12)%base)throw new Error('La conversión requiere más de doce decimales; elige otra unidad base')
  return normalizeUnitDecimal(fromTicks(measure*power(12)/base,12),{decimals:12,max:'99999999.999999999999',allowZero:false})
}
export function unitLineTotal(qty,price){
  const q=parts(normalizeUnitDecimal(qty,{decimals:6}),6)
  const p=parts(normalizeUnitDecimal(price,{decimals:18,max:'9999999999.99'}),18)
  const cents=(q.ticks*p.ticks+power(22)/2n)/power(22)
  normalizeUnitDecimal(fromTicks(cents,2),{decimals:2,max:'9999999999.99'})
  return `${cents/100n}.${(cents%100n).toString().padStart(2,'0')}`
}
export function formatUnitDecimal(raw,locale='es-GT'){
  const negative=raw.startsWith('-'),absolute=negative?raw.slice(1):raw
  const normalized=fromTicks(parts(absolute,18).ticks,18),[whole,fraction]=normalized.split('.')
  const formatter=new Intl.NumberFormat(locale)
  const separator=formatter.formatToParts(1.1).find(p=>p.type==='decimal')?.value||'.'
  return (negative?formatter.formatToParts(-1).find(p=>p.type==='minusSign')?.value??'-':'')+formatter.format(BigInt(whole))+(fraction?separator+fraction:'')
}
const rounded=(ticks,divisor)=>ticks<0n?-((-ticks+divisor/2n)/divisor):(ticks+divisor/2n)/divisor
export const unitTicks=raw=>parts(normalizeUnitDecimal(raw,{decimals:6}),6).ticks
export const unitFromTicks=ticks=>fromTicks(ticks,6)
export const addUnitQuantities=(a,b)=>normalizeUnitDecimal(unitFromTicks(unitTicks(a)+unitTicks(b)))
export const remainingUnitQuantity=(a,b)=>unitFromTicks(unitTicks(a)>unitTicks(b)?unitTicks(a)-unitTicks(b):0n)
const signedTicks=(raw,decimals)=>raw.startsWith('-')?-parts(raw.slice(1),decimals).ticks:parts(raw,decimals).ticks
export const compareUnitQuantities=(a,b)=>signedTicks(a,6)>signedTicks(b,6)?1:signedTicks(a,6)<signedTicks(b,6)?-1:0
export const compareUnitDecimals=(a,b)=>signedTicks(a,18)>signedTicks(b,18)?1:signedTicks(a,18)<signedTicks(b,18)?-1:0
export const stepUnitQuantity=(raw,direction)=>direction===1?addUnitQuantities(raw||'0','1'):remainingUnitQuantity(raw||'0','1')
export function previewUnitPartialTotal(totalBase,lineTotal,baseQty,consumedBase){
  const total=unitTicks(totalBase),consumed=unitTicks(consumedBase),end=consumed+unitTicks(baseQty)
  if(!total||end>total)throw Error('La cantidad excede el saldo base del documento')
  const amount=parts(normalizeUnitDecimal(lineTotal,{decimals:2,max:'9999999999.99'}),2).ticks,at=qty=>(amount*qty+total/2n)/total
  const value=at(end)-at(consumed)
  return `${value/100n}.${(value%100n).toString().padStart(2,'0')}`
}
// A partial's monetary amount uses frozen net/base counters; this quotient is only its displayed rate.
export function displayUnitRate(price,factor,originalQty='1'){
  const numerator=parts(normalizeUnitDecimal(price,{decimals:18,max:'9999999999.99'}),18).ticks
  const divisor=parts(normalizeUnitDecimal(factor,{decimals:12,max:'9999999999.99',allowZero:false}),12).ticks
  const quantity=unitTicks(originalQty)
  return fromTicks((numerator*quantity*power(6)+divisor/2n)/divisor,18)
}
const fixedTicks=(ticks,places)=>`${ticks<0n?'-':''}${(ticks<0n?-ticks:ticks)/power(places)}.${((ticks<0n?-ticks:ticks)%power(places)).toString().padStart(places,'0')}`
export function unitProductMetrics(price,cost,stock){
  const p=parts(price,12).ticks,c=parts(cost,12).ticks,s=parts(stock,6).ticks
  return {marginMoney:fixedTicks(rounded(p-c,power(10)),2),marginPercent:fixedTicks(p?rounded((p-c)*1000n,p):0n,1),inventoryValue:fixedTicks(rounded(c*s,power(16)),2)}
}
export function formatUnitMoney(raw,locale='es-GT',currency='GTQ'){
  const negative=raw.startsWith('-'),absolute=negative?raw.slice(1):raw
  const cents=rounded(parts(absolute,18).ticks,power(16))
  return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(negative?(cents/100n===0n?-0:-(cents/100n)):cents/100n).map(part=>part.type==='fraction'?(cents%100n).toString().padStart(2,'0'):part.value).join('')
}

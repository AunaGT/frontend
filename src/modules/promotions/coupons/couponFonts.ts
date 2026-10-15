import {jsPDF} from 'jspdf'
import {COUPON_FONT_LABELS,type CouponDesign,type CouponFontId,type CouponFontVariant,type TextStyle} from './couponDesign'
import type {CouponMeasure} from './couponPresentation'

export type {CouponFontId,CouponFontVariant} from './couponDesign'
type Files=Partial<Record<CouponFontVariant,string>>
const four=(dir:string,base:string):Files=>({normal:`/fonts/coupons/${dir}/${base}-Regular.ttf`,bold:`/fonts/coupons/${dir}/${base}-Bold.ttf`,italic:`/fonts/coupons/${dir}/${base}-Italic.ttf`,bolditalic:`/fonts/coupons/${dir}/${base}-BoldItalic.ttf`})
const two=(dir:string,base:string):Files=>({normal:`/fonts/coupons/${dir}/${base}-Regular.ttf`,bold:`/fonts/coupons/${dir}/${base}-Bold.ttf`})

// Registro único: los mismos archivos alimentan la vista previa (@font-face), la medición y el PDF.
// Helvetica es fuente estándar del PDF (sin archivo); el resto se incrusta solo si el cupón la usa.
export const COUPON_FONTS:Record<CouponFontId,{label:string;css:string;files:Files|null}>={
  NotoSans:{label:COUPON_FONT_LABELS.NotoSans,css:"CouponNoto, sans-serif",files:{normal:'/fonts/reports/NotoSans-Regular.ttf',bold:'/fonts/reports/NotoSans-Bold.ttf',italic:'/fonts/coupons/notosans/NotoSans-Italic.ttf',bolditalic:'/fonts/coupons/notosans/NotoSans-BoldItalic.ttf'}},
  Helvetica:{label:COUPON_FONT_LABELS.Helvetica,css:'Helvetica, Arial, sans-serif',files:null},
  Montserrat:{label:COUPON_FONT_LABELS.Montserrat,css:'CouponMontserrat, sans-serif',files:four('montserrat','Montserrat')},
  Poppins:{label:COUPON_FONT_LABELS.Poppins,css:'CouponPoppins, sans-serif',files:four('poppins','Poppins')},
  PlayfairDisplay:{label:COUPON_FONT_LABELS.PlayfairDisplay,css:'CouponPlayfairDisplay, serif',files:four('playfairdisplay','PlayfairDisplay')},
  Oswald:{label:COUPON_FONT_LABELS.Oswald,css:'CouponOswald, sans-serif',files:two('oswald','Oswald')},
  RobotoSlab:{label:COUPON_FONT_LABELS.RobotoSlab,css:'CouponRobotoSlab, serif',files:two('robotoslab','RobotoSlab')},
  BebasNeue:{label:COUPON_FONT_LABELS.BebasNeue,css:'CouponBebasNeue, sans-serif',files:{normal:'/fonts/coupons/bebasneue/BebasNeue-Regular.ttf'}},
  Pacifico:{label:COUPON_FONT_LABELS.Pacifico,css:'CouponPacifico, cursive',files:{normal:'/fonts/coupons/pacifico/Pacifico-Regular.ttf'}},
}
export const COUPON_FONT_IDS=Object.keys(COUPON_FONTS) as CouponFontId[]
export const fontVariant=({bold,italic}:{bold:boolean;italic?:boolean}):CouponFontVariant=>bold&&italic?'bolditalic':bold?'bold':italic?'italic':'normal'
export const supportsVariant=(font:CouponFontId,variant:CouponFontVariant)=>{const entry=COUPON_FONTS[font];return!!entry&&(!entry.files||!!entry.files[variant])}
export const couponFontIds=(design:CouponDesign):CouponFontId[]=>[...new Set<CouponFontId>(['NotoSans',...design.elements.flatMap(e=>e.kind==='field'||e.kind==='text'?[e.style.font as CouponFontId]:[])])]
const pdfName=(font:CouponFontId)=>font==='Helvetica'?'helvetica':font==='NotoSans'?'CouponNoto':'Coupon'+font

const pending=new Map<string,Promise<string>>(),loaded=new Map<string,string>()
const toBase64=(bytes:Uint8Array)=>{let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(binary)}
const loadFile=(file:string)=>{
  if(!pending.has(file))pending.set(file,fetch(file).then(async res=>{
    if(!res.ok)throw Error('No se pudo cargar la fuente del cupón. Intenta nuevamente.')
    const data=toBase64(new Uint8Array(await res.arrayBuffer()));loaded.set(file,data);return data
  }).catch(error=>{pending.delete(file);throw error}))
  return pending.get(file)!
}
// Descarga una sola vez cada fuente pedida; hay que esperarla antes de medir o generar el PDF.
export async function ensureCouponFonts(ids:CouponFontId[]){
  await Promise.all([...new Set(ids)].flatMap(id=>Object.values(COUPON_FONTS[id]?.files??{}).map(loadFile)))
}
export function installCouponFonts(doc:jsPDF,ids:CouponFontId[]){
  for(const id of new Set(ids))for(const[variant,file]of Object.entries(COUPON_FONTS[id]?.files??{})){
    const data=loaded.get(file);if(!data)throw Error(`Fuente no cargada: ${COUPON_FONTS[id].label}`)
    const name=`${pdfName(id)}-${variant}.ttf`;doc.addFileToVFS(name,data);doc.addFont(name,pdfName(id),variant)
  }
}
export const setCouponFont=(doc:jsPDF,style:TextStyle,size=style.fontSize)=>{doc.setFont(pdfName(style.font as CouponFontId),fontVariant(style));doc.setFontSize(size)}

// Un documento de medición compartido; cada fuente se registra la primera vez que se mide con ella.
let measureDoc:jsPDF|null=null
const measured=new Set<CouponFontId>()
export async function createCouponMeasure(ids:CouponFontId[]=['NotoSans']):Promise<CouponMeasure>{
  await ensureCouponFonts(['NotoSans',...ids])
  const doc=measureDoc??=new jsPDF({unit:'pt'})
  const ready=(style:TextStyle)=>{const font=style.font as CouponFontId;if(!measured.has(font)){installCouponFonts(doc,[font]);measured.add(font)}setCouponFont(doc,style)}
  const measure:CouponMeasure=(text,style)=>{ready(style);return doc.getTextWidth(text)+(style.letterSpacing??0)*[...text].length}
  measure.supports=(text,style)=>{
    ready(style)
    if(style.font==='Helvetica')return [...text].every(c=>c.codePointAt(0)!<256)
    const font=doc.getFont() as unknown as {metadata:{cmap:{unicode:{codeMap:Record<number,number>}}}}
    const cmap=font.metadata.cmap.unicode.codeMap
    return [...text].every(c=>c.codePointAt(0)!<=32||!!cmap[c.codePointAt(0)!])
  }
  return measure
}

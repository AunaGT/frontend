
export type CouponField = 'company'|'companyLogo'|'name'|'description'|'benefit'|'code'|'validity'|'branches'|'limits'|'minimumPurchase'|'state'|'terms'
export type CouponFontId='NotoSans'|'Helvetica'|'Montserrat'|'Poppins'|'PlayfairDisplay'|'Oswald'|'RobotoSlab'|'BebasNeue'|'Pacifico'
export type CouponFontVariant='normal'|'bold'|'italic'|'bolditalic'
// Variantes que realmente existen por familia: lo que no está aquí se rechaza, nunca se simula.
export const COUPON_FONT_VARIANTS:Record<CouponFontId,readonly CouponFontVariant[]>={NotoSans:['normal','bold','italic','bolditalic'],Helvetica:['normal','bold','italic','bolditalic'],Montserrat:['normal','bold','italic','bolditalic'],Poppins:['normal','bold','italic','bolditalic'],PlayfairDisplay:['normal','bold','italic','bolditalic'],Oswald:['normal','bold'],RobotoSlab:['normal','bold'],BebasNeue:['normal'],Pacifico:['normal']}
export const COUPON_FONT_LABELS:Record<CouponFontId,string>={NotoSans:'Noto Sans',Helvetica:'Helvetica',Montserrat:'Montserrat',Poppins:'Poppins',PlayfairDisplay:'Playfair Display',Oswald:'Oswald',RobotoSlab:'Roboto Slab',BebasNeue:'Bebas Neue',Pacifico:'Pacifico'}
export type Shadow={x:number;y:number;color:string;opacity:number}
export type Gradient={from:string;to:string;via?:string;angle:number}
// Fase 2: claves opcionales; ausentes = comportamiento de la fase 1, así los cupones guardados siguen válidos.
export type TextStyle = {font:CouponFontId;fontSize:number;bold:boolean;color:string;align:'left'|'center'|'right';lineHeight:number;padding:number;background:string|null;borderColor:string|null;borderWidth:number;radius:number
  italic?:boolean;underline?:boolean;strike?:boolean;uppercase?:boolean;letterSpacing?:number;strokeColor?:string|null;strokeWidth?:number;shadow?:Shadow|null}
export type Box = {id:string;x:number;y:number;width:number;height:number;visible:boolean;locked:boolean;opacity:number;rotation?:number}
export type CouponShape='rect'|'line'|'ellipse'|'star'|'badge'
export type CouponElement = Box & ({kind:'field';field:CouponField;style:TextStyle}|{kind:'text';text:string;style:TextStyle}|{kind:'image';assetId:string;fit:'contain'|'cover';focalX:number;focalY:number;radius?:number;shadow?:Shadow|null}|{kind:'shape';shape:CouponShape;color:string;borderColor:string;borderWidth:number;radius:number;borderStyle?:'solid'|'dashed'|'dotted';gradient?:Gradient|null;shadow?:Shadow|null})
export type CouponBackground = {kind:'solid';color:string}|{kind:'gradient';from:string;to:string;via?:string;angle?:number}|{kind:'image';assetId:string;fit:'contain'|'cover';focalX:number;focalY:number}
export type CouponDesign = {printPreset:'standard'|'large';terms:string;background:CouponBackground;elements:CouponElement[];aspect?:number}
export const COUPON_ASPECT={min:.5,max:3}
export const couponHeight=(design:{aspect?:number})=>design.aspect?1000/design.aspect:720

const FIELDS = ['company','companyLogo','name','description','benefit','code','validity','branches','limits','minimumPurchase','state','terms']
const HEX = /^#[0-9a-fA-F]{6}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = field => { throw Object.assign(new Error('Revisa el diseño del cupón: ' + field), {status:400, field}) }
const keys = (value: unknown, names: string[], path: string, optional: string[] = []) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).some(key=>!names.includes(key)&&!optional.includes(key)) ||
      names.some(key=>!Object.prototype.hasOwnProperty.call(value,key))) fail(path)
}
const number = (value,min,max,path) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path)
}
const choice = (value,values,path) => { if(!values.includes(value)) fail(path) }
const color = (value,path,nullable=false) => { if(!(nullable && value===null) && !(typeof value==='string' && HEX.test(value))) fail(path) }
const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value,key)
const flag = (value,key,path) => { if(has(value,key) && typeof value[key]!=='boolean') fail(path+'.'+key) }
const shadow = (value,path) => {
  if(value===null) return
  keys(value,['x','y','color','opacity'],path)
  number(value.x,-40,40,path+'.x'); number(value.y,-40,40,path+'.y'); color(value.color,path+'.color'); number(value.opacity,0,1,path+'.opacity')
}
const gradient = (value,path,angleRequired=true) => {
  if(value===null) return
  keys(value,angleRequired?['from','to','angle']:['from','to'],path,angleRequired?['via']:['via','angle'])
  color(value.from,path+'.from'); color(value.to,path+'.to')
  if(has(value,'via')) { color(value.via,path+'.via'); if(!has(value,'angle')) fail(path+'.angle') }
  if(has(value,'angle')) number(value.angle,0,360,path+'.angle')
}
const image = (value,path) => {
  if(typeof value.assetId !== 'string' || !UUID.test(value.assetId)) fail(path+'.assetId')
  choice(value.fit,['contain','cover'],path+'.fit')
  number(value.focalX,0,1,path+'.focalX'); number(value.focalY,0,1,path+'.focalY')
}
export function couponAssetIds(design: CouponDesign | null): string[] {
  if(!design) return []
  return [...new Set([...(design.background.kind==='image'?[design.background.assetId]:[]),
    ...design.elements.filter(e=>e.kind==='image').map(e=>e.assetId)])]
}
export function parseCouponDesign(input: unknown): CouponDesign | null {
  const value=input as CouponDesign
  if(value===null) return null
  keys(value,['printPreset','terms','background','elements'],'coupon_design',['aspect'])
  // Fase 3: proporción tomada de la imagen del cliente (ancho/alto); sin ella, 1000 × 720 de siempre.
  if(has(value,'aspect')) number(value.aspect,COUPON_ASPECT.min,COUPON_ASPECT.max,'aspect')
  choice(value.printPreset,['standard','large'],'printPreset')
  if(typeof value.terms !== 'string' || value.terms.length>500) fail('terms')
  const bg=value.background
  const bgKeys=bg?.kind==='solid'?['kind','color']:bg?.kind==='gradient'?['kind','from','to']:['kind','assetId','fit','focalX','focalY']
  keys(bg,bgKeys,'background',bg?.kind==='gradient'?['via','angle']:[]); choice(bg.kind,['solid','gradient','image'],'background.kind')
  if(bg.kind==='solid') color(bg.color,'background.color')
  else if(bg.kind==='gradient') { const {kind:_kind,...rest}=bg; gradient(rest,'background',false) }
  else image(bg,'background')
  if(!Array.isArray(value.elements) || value.elements.length>30) fail('elements')
  const ids=new Set<string>(), fields=new Set<CouponField>()
  for(const e of value.elements) {
    const path='elements.'+(e?.id || '?')
    const specific=e?.kind==='field'?['field','style']:e?.kind==='text'?['text','style']:e?.kind==='image'?['assetId','fit','focalX','focalY']:['shape','color','borderColor','borderWidth','radius']
    // Los campos obligatorios no se rotan: las comprobaciones de legibilidad suponen cajas alineadas.
    const optional=e?.kind==='field'?[]:e?.kind==='text'?['rotation']:e?.kind==='image'?['rotation','radius','shadow']:['rotation','borderStyle','gradient','shadow']
    keys(e,['id','kind','x','y','width','height','visible','locked','opacity',...specific],path,optional)
    if(has(e,'rotation')) number(e.rotation,-180,180,path+'.rotation')
    choice(e.kind,['field','text','image','shape'],path+'.kind')
    if(typeof e.id!=='string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(e.id) || ids.has(e.id)) fail(path+'.id')
    ids.add(e.id)
    for(const key of ['x','y','width','height','opacity']) number(e[key],0,1,path+'.'+key)
    if(e.width<=0 || e.height<=0 || e.x+e.width>1.000000001 || e.y+e.height>1.000000001) fail(path+'.box')
    if(typeof e.visible!=='boolean' || typeof e.locked!=='boolean') fail(path+'.visible')
    if(e.kind==='field') {
      choice(e.field,FIELDS,path+'.field')
      if(fields.has(e.field)) fail(path+'.field')
      fields.add(e.field)
      if(['code','benefit'].includes(e.field) && (!e.visible || e.opacity!==1)) fail(path+'.'+e.field)
    }
    if(e.kind==='text' && (typeof e.text!=='string' || e.text.length>1000)) fail(path+'.text')
    if(e.kind==='text' || e.kind==='field') {
      const s=e.style
      keys(s,['font','fontSize','bold','color','align','lineHeight','padding','background','borderColor','borderWidth','radius'],path+'.style',['italic','underline','strike','uppercase','letterSpacing','strokeColor','strokeWidth','shadow'])
      choice(s.font,Object.keys(COUPON_FONT_VARIANTS),path+'.font'); choice(s.align,['left','center','right'],path+'.align')
      if(typeof s.bold!=='boolean') fail(path+'.bold')
      for(const key of ['italic','underline','strike','uppercase']) flag(s,key,path)
      const variant=s.bold&&s.italic?'bolditalic':s.bold?'bold':s.italic?'italic':'normal'
      if(!COUPON_FONT_VARIANTS[s.font].includes(variant)) fail(path+'.font')
      if(has(s,'letterSpacing')) number(s.letterSpacing,-5,40,path+'.letterSpacing')
      if(has(s,'strokeColor')) color(s.strokeColor,path+'.strokeColor',true)
      if(has(s,'strokeWidth')) number(s.strokeWidth,0,10,path+'.strokeWidth')
      if(has(s,'shadow')) shadow(s.shadow,path+'.shadow')
      number(s.fontSize,10,96,path+'.fontSize'); number(s.lineHeight,1,2,path+'.lineHeight')
      number(s.padding,0,30,path+'.padding'); number(s.borderWidth,0,20,path+'.borderWidth'); number(s.radius,0,100,path+'.radius')
      color(s.color,path+'.color'); color(s.background,path+'.background',true); color(s.borderColor,path+'.borderColor',true)
    } else if(e.kind==='image') {
      image(e,path)
      if(has(e,'radius')) number(e.radius,0,100,path+'.radius')
      if(has(e,'shadow')) shadow(e.shadow,path+'.shadow')
    } else {
      choice(e.shape,['rect','line','ellipse','star','badge'],path+'.shape'); color(e.color,path+'.color');color(e.borderColor,path+'.borderColor')
      number(e.borderWidth,0,20,path+'.borderWidth'); number(e.radius,0,100,path+'.radius')
      if(has(e,'borderStyle')) choice(e.borderStyle,['solid','dashed','dotted'],path+'.borderStyle')
      if(has(e,'gradient')) gradient(e.gradient,path+'.gradient')
      if(has(e,'shadow')) shadow(e.shadow,path+'.shadow')
    }
  }
  if(!fields.has('code') || !fields.has('benefit')) fail('code/benefit')
  if(couponAssetIds(value as unknown as CouponDesign).length>5) fail('images')
  return JSON.parse(JSON.stringify(value)) as CouponDesign
}
function assertCouponRestrictionFields(design,promotion) {
  if(!design) return
  const required=['code','benefit']
  if(promotion.start_date || promotion.end_date) required.push('validity')
  if(promotion.applies_to_all_branches===false) required.push('branches')
  if(Number(promotion.max_uses)>0 || promotion.single_use) required.push('limits')
  if(Number(promotion.min_purchase)>0) required.push('minimumPurchase')
  if(promotion.active===false) required.push('state')
  for(const field of required) {
    const e=design.elements.find(e=>e.kind==='field' && e.field===field)
    if(!e || !e.visible || e.opacity!==1) fail(field)
  }
}

export const COUPON_FIELD_LABELS: Record<CouponField,string> = {company:'Empresa',companyLogo:'Logo',name:'Nombre',description:'Descripción',benefit:'Beneficio',code:'Código',validity:'Vigencia',branches:'Sucursales',limits:'Usos',minimumPurchase:'Compra mínima',state:'Estado',terms:'Condiciones'}
export const textStyle = (values: Partial<TextStyle> = {}): TextStyle => ({font:'NotoSans',fontSize:30,bold:false,color:'#ffffff',align:'left',lineHeight:1.2,padding:0,background:null,borderColor:null,borderWidth:0,radius:0,...values})
export function createDefaultCouponDesign(): CouponDesign {
  const field=(name:CouponField,x:number,y:number,width:number,height:number,style:Partial<TextStyle>={}):CouponElement=>({id:'field-'+name,kind:'field',field:name,x,y,width,height,visible:true,locked:false,opacity:1,style:textStyle(style)})
  return {printPreset:'standard',terms:'',background:{kind:'gradient',from:'#0c203a',to:'#ff6f00'},elements:[
    {id:'lower-band',kind:'shape',shape:'rect',color:'#f5f7fa',borderColor:'#f5f7fa',borderWidth:0,radius:0,x:0,y:.59,width:1,height:.41,visible:true,locked:true,opacity:1},
    field('company',.05,.035,.76,.065,{fontSize:28,bold:true}),
    field('companyLogo',.84,.035,.11,.11),
    {id:'promotion-label',kind:'text',text:'PROMOCIÓN',x:.05,y:.12,width:.24,height:.055,visible:true,locked:false,opacity:1,style:textStyle({fontSize:22,bold:true,background:'#b94700',padding:6,radius:16})},
    field('name',.05,.20,.9,.115,{fontSize:42,bold:true}),
    field('description',.05,.32,.9,.08,{fontSize:28}),
    field('benefit',.05,.415,.9,.08,{fontSize:36,bold:true}),
    field('code',.05,.515,.9,.065,{fontSize:32,bold:true}),
    field('validity',.05,.615,.9,.05,{fontSize:22,color:'#23364d'}),
    field('branches',.05,.67,.9,.05,{fontSize:22,color:'#23364d'}),
    field('limits',.05,.725,.9,.05,{fontSize:22,color:'#23364d'}),
    field('minimumPurchase',.05,.78,.9,.05,{fontSize:22,color:'#23364d'}),
    field('state',.05,.835,.9,.045,{fontSize:22,color:'#23364d'}),
    field('terms',.05,.89,.9,.075,{fontSize:22,color:'#23364d'}),
  ]}
}

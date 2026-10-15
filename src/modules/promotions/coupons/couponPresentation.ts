import {COUPON_FIELD_LABELS,type CouponDesign,type CouponField,type CouponBackground,type CouponShape,type Gradient,type Shadow,type TextStyle,couponHeight} from './couponDesign'
export type CouponBranding={companyName:string;logoDataUrl?:string;locale:string;currencyCode:string;timezone:string}
export interface CouponPromotion {
  name:string;description?:string|null;type?:{name:string};discount_percentage?:string|number|null;discount_value?:string|number|null;
  buy_quantity?:number|null;get_quantity?:number|null;min_quantity?:number|null;start_date?:string|null;end_date?:string|null;
  max_uses?:number|null;max_uses_per_customer?:number|null;min_purchase_amount?:string|number|null;active?:boolean;
  applies_to_all_branches?:boolean;branches?:Array<{branch:{name:string}}>;
  coupon_design?:CouponDesign|null
}
export type CouponCode={code:string;active?:boolean;current_uses?:number}
export type CouponData=Record<Exclude<CouponField,'companyLogo'>,string>&{companyLogo:boolean;requiredFields:CouponField[]}
type SceneBox={id:string;x:number;y:number;width:number;height:number;opacity:number;rotation?:number}
export type SceneNode=SceneBox&(
  {kind:'text';field?:CouponField;text:string;style:TextStyle;lines:{text:string;x:number;baseline:number;width:number}[]}|
  {kind:'image';source:{assetId:string}|{companyLogo:true};fit:'contain'|'cover';focalX:number;focalY:number;radius?:number;shadow?:Shadow|null}|
  {kind:'shape';shape:CouponShape;color:string;borderColor:string;borderWidth:number;radius:number;borderStyle?:'solid'|'dashed'|'dotted';gradient?:Gradient|null;shadow?:Shadow|null}|
  {kind:'background';fill:CouponBackground})
// Degradado con ángulo estilo CSS (0° hacia arriba, 90° hacia la derecha): mismo eje en SVG, PDF y contraste.
export function gradientLine(angle:number,box:{x:number;y:number;width:number;height:number}){
  const r=angle*Math.PI/180,dx=Math.sin(r),dy=-Math.cos(r),half=(Math.abs(box.width*dx)+Math.abs(box.height*dy))/2,cx=box.x+box.width/2,cy=box.y+box.height/2
  return{x1:cx-dx*half,y1:cy-dy*half,x2:cx+dx*half,y2:cy+dy*half}
}
// Estrella de 5 puntas y sello de 16, inscritos en la caja: los mismos vértices en SVG y PDF.
export function shapePoints(shape:'star'|'badge',box:{x:number;y:number;width:number;height:number}):[number,number][]{
  const[points,inner]=shape==='star'?[5,.45]:[16,.82],cx=box.x+box.width/2,cy=box.y+box.height/2
  return Array.from({length:points*2},(_,i)=>{const r=i%2?inner:1,a=-Math.PI/2+i*Math.PI/points;return[cx+Math.cos(a)*box.width/2*r,cy+Math.sin(a)*box.height/2*r]})
}
// Trazo discontinuo o punteado proporcional al grosor; los puntos usan extremos redondos.
export const dashPattern=(style:'solid'|'dashed'|'dotted'|undefined,width:number):number[]|null=>style==='dashed'?[Math.max(3,width*3),Math.max(2,width*2)]:style==='dotted'?[.001,Math.max(2,width*2)]:null
export const gradientStops=(g:{from:string;to:string;via?:string})=>g.via?[{offset:0,color:g.from},{offset:.5,color:g.via},{offset:1,color:g.to}]:[{offset:0,color:g.from},{offset:1,color:g.to}]
// Área realmente pintada: caja envolvente de la rotación más el desplazamiento de la sombra.
function paintedBox(n:SceneNode):SceneBox{
  let box:SceneBox={id:n.id,x:n.x,y:n.y,width:n.width,height:n.height,opacity:n.opacity}
  const r=(n.rotation??0)*Math.PI/180
  if(r){const c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),w=n.width*c+n.height*s,h=n.width*s+n.height*c;box={...box,x:n.x+n.width/2-w/2,y:n.y+n.height/2-h/2,width:w,height:h}}
  const shadow=n.kind==='text'?n.style.shadow:n.kind==='shape'||n.kind==='image'?n.shadow:null
  if(shadow)box={...box,x:box.x+Math.min(0,shadow.x),y:box.y+Math.min(0,shadow.y),width:box.width+Math.abs(shadow.x),height:box.height+Math.abs(shadow.y)}
  return box
}
export type CouponIssue={elementId:string;code:string;severity:'warning'|'error';message:string}
export type CouponScene={width:1000;height:number;nodes:SceneNode[];issues:CouponIssue[]}
export type CouponMeasure=((text:string,style:TextStyle)=>number)&{supports?:(text:string,style:TextStyle)=>boolean}
// Un solo código sin límite de usos sirve a todos los clientes: se puede imprimir en varias copias.
export const sharedCouponCode=(p:{max_uses?:number|string|null;codes?:unknown[]})=>(p.codes?.length??0)===1&&!(Number(p.max_uses)>0)
// Cupón sin el código impreso: el cliente lo presenta y el cajero aplica la promoción.
export const withoutCouponCode=(design:CouponDesign):CouponDesign=>({...design,elements:design.elements.map(e=>e.kind==='field'&&e.field==='code'?{...e,visible:false}:e)})
export function couponData(p:CouponPromotion,code:CouponCode,branding:CouponBranding):CouponData {
  const pct=Number(p.discount_percentage)||0,money=(value:unknown)=>new Intl.NumberFormat(branding.locale||'es-GT',{style:'currency',currency:branding.currencyCode||'GTQ'}).format(Number(value)||0)
  const combo=pct>0?`${pct}% en el segundo producto del combo`:Number(p.discount_value)>0?`Hasta ${money(p.discount_value)} de descuento en el segundo producto del combo`:'Combo sin descuento configurado'
  const benefits:Record<string,string>={PERCENTAGE:`${pct}% de descuento`,FIXED_AMOUNT:`${money(p.discount_value)} de descuento`,BUY_X_GET_Y:`Lleva ${p.buy_quantity||2}, paga ${(p.buy_quantity||2)-(p.get_quantity||1)}`,MIN_QTY_DISCOUNT:`${pct}% de descuento desde ${p.min_quantity||1} unidades`,FREE_GIFT:'Regalo al comprar el producto participante',COMBO_DISCOUNT:combo}
  const date=(value?:string|null)=>{
    if(!value)return 'Sin límite'
    const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00Z':value)
    return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(branding.locale||'es-GT',{day:'2-digit',month:'short',year:'numeric',timeZone:branding.timezone||'America/Guatemala'}).format(d):'Fecha no válida'
  }
  const limited=Number(p.max_uses)>0,perCustomer=Number(p.max_uses_per_customer)>0,min=Number(p.min_purchase_amount)>0
  const inactive=p.active===false||code.active===false||(limited&&Number(code.current_uses)>=Number(p.max_uses))
  const requiredFields:CouponField[]=['code','benefit']
  if(p.start_date||p.end_date)requiredFields.push('validity')
  if(p.applies_to_all_branches===false)requiredFields.push('branches')
  if(limited||perCustomer)requiredFields.push('limits')
  if(min)requiredFields.push('minimumPurchase')
  if(inactive)requiredFields.push('state')
  return{company:branding.companyName,companyLogo:!!branding.logoDataUrl,name:p.name||'Nombre de la promoción',description:p.description||'',benefit:benefits[p.type?.name||'']||'Beneficio de promoción',code:code.code,
    validity:`Vigencia: ${date(p.start_date)} - ${date(p.end_date)}`,
    branches:p.applies_to_all_branches===false?(p.branches||[]).map(b=>b.branch.name).join(', ')||'Selecciona sucursales':'Todas las sucursales',
    limits:[limited?`Hasta ${p.max_uses} usos por código`:'Sin límite de usos por código',perCustomer?`${p.max_uses_per_customer} por cliente`:''].filter(Boolean).join(' · '),
    minimumPurchase:min?`Compra mínima: ${money(p.min_purchase_amount)}`:'',state:inactive?'No disponible para canje':'Habilitada',terms:p.coupon_design?.terms||'',requiredFields}
}
export const requiredCouponFields=(data:CouponData)=>data.requiredFields
export function couponImagePlacement(box:{x:number;y:number;width:number;height:number},image:{width:number;height:number},fit:'contain'|'cover',focalX=.5,focalY=.5){
  const scale=fit==='cover'?Math.max(box.width/image.width,box.height/image.height):Math.min(box.width/image.width,box.height/image.height)
  const width=image.width*scale,height=image.height*scale
  return{x:box.x+(box.width-width)*focalX,y:box.y+(box.height-height)*focalY,width,height}
}
export type CouponPrintLayout={orientation:'portrait'|'landscape';pageWidth:number;pageHeight:number;tileWidth:number;tileHeight:number;columns:number;rows:number;gap:number;top:number}
export function getCouponPrintLayout(preset:CouponDesign['printPreset'],aspect?:number):CouponPrintLayout{
  if(!aspect)return preset==='large'?{orientation:'portrait' as const,pageWidth:210,pageHeight:297,tileWidth:185,tileHeight:133.2,columns:1,rows:2,gap:6,top:8}:{orientation:'landscape' as const,pageWidth:297,pageHeight:210,tileWidth:120,tileHeight:86.4,columns:2,rows:2,gap:6,top:10}
  // Con proporción propia: la rejilla y la orientación A4 que dan el cupón más grande (márgenes de 10 mm, 16 abajo por el pie, 6 entre cupones).
  const count=preset==='large'?2:4,gap=6
  let best:CouponPrintLayout|null=null
  for(const[orientation,pageWidth,pageHeight]of[['portrait',210,297],['landscape',297,210]] as const)for(let columns=1;columns<=count;columns++){
    if(count%columns)continue
    const rows=count/columns,tileWidth=Math.min((pageWidth-20-(columns-1)*gap)/columns,(pageHeight-26-(rows-1)*gap)/rows*aspect),tileHeight=tileWidth/aspect
    if(!best||tileWidth>best.tileWidth+1e-9)best={orientation,pageWidth,pageHeight,tileWidth,tileHeight,columns,rows,gap,top:10+(pageHeight-26-rows*tileHeight-(rows-1)*gap)/2}
  }
  return best!
}
function wrap(text:string,width:number,style:TextStyle,measure:CouponMeasure):string[]{
  const lines:string[]=[]
  for(const paragraph of text.split('\n')){
    let line=''
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      if(line && measure(line+' '+word,style)>width){lines.push(line);line=''}
      if(measure(word,style)>width){
        for(const char of [...word]){if(line&&measure(line+char,style)>width){lines.push(line);line=''}line+=char}
      }else line+=(line?' ':'')+word
    }
    lines.push(line)
  }
  return lines
}
export function prepareCouponScene(design:CouponDesign,data:CouponData,measure:CouponMeasure):CouponScene{
  const H=couponHeight(design)
  const nodes:SceneNode[]=[{id:'background',kind:'background',x:0,y:0,width:1000,height:H,opacity:1,fill:design.background}],issues:CouponIssue[]=[]
  const issue=(id:string,code:string,message:string,severity:'warning'|'error'='error')=>issues.push({elementId:id,code,severity,message})
  const required=new Set(data.requiredFields)
  for(const field of required){const e=design.elements.find(e=>e.kind==='field'&&e.field===field);if(!e||!e.visible||e.opacity!==1)issue(e?.id||'field-'+field,'REQUIRED',`El campo ${COUPON_FIELD_LABELS[field]} debe permanecer visible`)}
  for(const e of design.elements){
    if(!e.visible)continue
    // Las claves de la fase 2 solo aparecen si el diseño las tiene: un cupón de la fase 1 produce la misma escena.
    const box={id:e.id,x:e.x*1000,y:e.y*H,width:e.width*1000,height:e.height*H,opacity:e.opacity,...(e.rotation!==undefined?{rotation:e.rotation}:{})}
    if(e.kind==='shape'){nodes.push({...e,...box});continue}
    if(e.kind==='image'){nodes.push({...box,kind:'image',source:{assetId:e.assetId},fit:e.fit,focalX:e.focalX,focalY:e.focalY,...(e.radius!==undefined?{radius:e.radius}:{}),...(e.shadow!==undefined?{shadow:e.shadow}:{})});continue}
    if(e.kind==='field'&&e.field==='companyLogo'){
      if(data.companyLogo)nodes.push({...box,kind:'image',source:{companyLogo:true},fit:'contain',focalX:.5,focalY:.5})
      continue
    }
    const raw=e.kind==='text'?e.text:e.field==='terms'?design.terms:data[e.field] as string
    if(!raw)continue
    const text=e.style.uppercase?raw.toLocaleUpperCase('es'):raw
    const s=e.style,lines=wrap(text,box.width-2*s.padding,s,measure),lineHeight=s.fontSize*s.lineHeight
    const label=e.kind==='field'?COUPON_FIELD_LABELS[e.field]:'Texto'
    if(lines.length*lineHeight>box.height-2*s.padding || lines.some(l=>measure(l,s)>box.width-2*s.padding+.01))issue(e.id,'TEXT_OVERFLOW',`${label}: el texto no cabe. Amplía la caja o reduce el tamaño.`)
    // 6 pt impresos; el mensaje habla en las unidades del editor (px del diseño) según el tamaño de impresión.
    const ptPerUnit=getCouponPrintLayout(design.printPreset,design.aspect).tileWidth/1000*72/25.4
    if(s.fontSize*ptPerUnit<6){
      const minPx=Math.ceil(6/ptPerUnit),mandatory=e.kind==='field'&&required.has(e.field)
      // El estado solo es obligatorio en códigos usados o inactivos: se avisa en el diseño y se bloquea al exportar esos códigos.
      const message=e.kind==='field'&&e.field==='state'
        ?mandatory?`El código ${data.code} ya no está disponible y su estado debe leerse en el cupón: sube «Estado» a ${minPx}px o más, o quita ese código de la selección.`:`Estado: usa al menos ${minPx}px; es obligatorio en los códigos usados o inactivos.`
        :`${label}: usa al menos ${minPx}px para que se lea al imprimir (6 pt).`
      issue(e.id,'SMALL_TEXT',message,mandatory?'error':'warning')
    }
    if(e.kind==='field'&&required.has(e.field)&&(e.x<.025||e.y<.025||e.x+e.width>.975||e.y+e.height>.975))issue(e.id,'SAFE_MARGIN',`${label}: mueve el campo dentro del margen seguro.`)
    if(measure.supports && !measure.supports(text,s))issue(e.id,'UNSUPPORTED_GLYPH',`${label}: contiene caracteres no compatibles con la fuente elegida.`)
    nodes.push({...box,kind:'text',...(e.kind==='field'?{field:e.field}:{}),text,style:s,lines:lines.map((text,i)=>({text,x:box.x+s.padding+(s.align==='center'?(box.width-2*s.padding)/2:s.align==='right'?box.width-2*s.padding:0),baseline:box.y+s.padding+s.fontSize*.85+i*lineHeight,width:measure(text,s)}))})
  }
  const overlap=(a:SceneBox,b:SceneBox)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height
  const lineBox=(node:Extract<SceneNode,{kind:'text'}>,line:{text:string;x:number;baseline:number})=>{
    const w=measure(line.text,node.style)
    return{id:node.id,x:line.x-(node.style.align==='center'?w/2:node.style.align==='right'?w:0),y:line.baseline-node.style.fontSize*.85,width:w,height:node.style.fontSize,opacity:1}
  }
  const rgb=(color:string)=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16))
  const luminance=(values:number[])=>values.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
  const colorAt=(x:number,y:number,index:number):number[]|null=>{
    let color:number[]|null=null
    const composite=(paint:number[],opacity:number)=>{color=opacity===1?paint:color?color.map((v,i)=>v*(1-opacity)+paint[i]*opacity):null}
    for(const n of nodes.slice(0,index)){
      if(x<n.x||x>n.x+n.width||y<n.y||y>n.y+n.height)continue
      if(n.kind==='background'){
        if(n.fill.kind==='solid')color=rgb(n.fill.color)
        else if(n.fill.kind==='gradient'&&n.fill.angle===undefined){const t=Math.max(0,Math.min(1,((x/1000+.59*y/H)/(1+.59**2)-.5)*2)),a=rgb(n.fill.from),b=rgb(n.fill.to);color=a.map((v,i)=>v+(b[i]-v)*t)}
        else if(n.fill.kind==='gradient'){
          const l=gradientLine(n.fill.angle!,{x:0,y:0,width:1000,height:H}),dx=l.x2-l.x1,dy=l.y2-l.y1,t=Math.max(0,Math.min(1,((x-l.x1)*dx+(y-l.y1)*dy)/(dx*dx+dy*dy||1)))
          const stops=gradientStops(n.fill),i=Math.max(0,stops.findIndex(stop=>stop.offset>=t)-1),a=stops[i],b=stops[Math.min(i+1,stops.length-1)],k=b.offset>a.offset?(t-a.offset)/(b.offset-a.offset):0
          color=rgb(a.color).map((v,j)=>v+(rgb(b.color)[j]-v)*k)
        }
        else color=null
      }else if(n.kind==='image'&&n.opacity>0)color=null
      else if(n.kind==='shape'&&n.shape==='rect'&&!n.rotation&&!n.gradient)composite(rgb(n.color),n.opacity)
      else if(n.kind==='shape'&&n.shape!=='line')color=null // forma rotada, curva o con degradado: color de fondo desconocido
      else if(n.kind==='text'&&n.style.background)composite(rgb(n.style.background),n.opacity)
    }
    return color
  }
  const lineHits=(line:Extract<SceneNode,{kind:'shape'}>,box:SceneBox)=>{
    const radius=(line.borderWidth||2)/2,minX=box.x-radius,maxX=box.x+box.width+radius,minY=box.y-radius,maxY=box.y+box.height+radius
    let from=0,to=1
    for(const [p,q] of [[-line.width,line.x-minX],[line.width,maxX-line.x],[-line.height,line.y-minY],[line.height,maxY-line.y]]){
      if(p===0){if(q<0)return false;continue}
      const t=q/p;if(p<0)from=Math.max(from,t);else to=Math.min(to,t)
      if(from>to)return false
    }
    return true
  }
  nodes.forEach((node,index)=>{
    if(node.kind!=='text')return
    const mandatory=!!node.field&&required.has(node.field)
    const ink=luminance(rgb(node.style.color))
    for(const line of node.lines){
      const box=lineBox(node,line),bg=node.style.background?rgb(node.style.background):colorAt(box.x+box.width/2,box.y+box.height/2,index)
      if(bg){const light=luminance(bg),ratio=(Math.max(ink,light)+.05)/(Math.min(ink,light)+.05);if(ratio<4.5){issue(node.id,'LOW_CONTRAST',`${node.field?COUPON_FIELD_LABELS[node.field]:'Texto'}: aumenta el contraste de texto y fondo.`,mandatory&&ratio<3?'error':'warning');break}}
    }
    for(const above of nodes.slice(index+1)){
      const area=paintedBox(above),straightLine=above.kind==='shape'&&above.shape==='line'&&!above.rotation&&!above.shadow
      const covered=node.lines.some(line=>straightLine?lineHits(above as Extract<SceneNode,{kind:'shape'}>,lineBox(node,line)):overlap(lineBox(node,line),area))
      const opaque=above.opacity>.05&&(above.kind==='image'||above.kind==='shape'||above.kind==='text'&&!!above.style.background)
      const textOverlap=above.kind==='text'&&above.opacity>.05&&(above.rotation||above.style.shadow?node.lines.some(a=>overlap(lineBox(node,a),area)):node.lines.some(a=>above.lines.some(b=>overlap(lineBox(node,a),lineBox(above,b)))))
      if(covered&&opaque||textOverlap)issue(node.id,'OCCLUDED',`${node.field?COUPON_FIELD_LABELS[node.field]:'Texto'} está tapado por otra capa. Cambia su orden.`,mandatory?'error':'warning')
    }
  })
  return{width:1000,height:H,nodes,issues}
}

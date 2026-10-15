import {COUPON_ASPECT,COUPON_FONT_LABELS,COUPON_FONT_VARIANTS,parseCouponDesign,textStyle,type CouponBackground,type CouponDesign,type CouponElement,type CouponField,type CouponFontId,type CouponShape,type Gradient,type Shadow,type TextStyle} from './couponDesign'

// Lenguaje del cupón: subconjunto estricto de XML que se compila al mismo JSON validado.
// Nunca se ejecuta ni se inserta como HTML; todo lo que no está en la lista blanca es error.
export type CouponCodeError={message:string;line:number;column:number;from:number;to:number}
export type CouponCodeRange={from:number;to:number}
export type CouponCodeResult={ok:true;design:CouponDesign;ranges:Record<string,CouponCodeRange>}|{ok:false;errors:CouponCodeError[]}

export const MAX_COUPON_CODE=30000
export const COUPON_CODE_FIELDS:Record<CouponField,string>={company:'empresa',companyLogo:'logo',name:'nombre',description:'descripcion',benefit:'beneficio',code:'codigo',validity:'vigencia',branches:'sucursales',limits:'usos',minimumPurchase:'compra-minima',state:'estado',terms:'condiciones'}
const TEXT_PROPS=['font-family','font-size','font-weight','color','text-align','line-height','padding','background','border','border-radius','font-style','text-decoration','text-transform','letter-spacing','-webkit-text-stroke','text-shadow','opacity']
const LAYER_ATTRS=['x','y','ancho','alto','oculto','bloqueado','style']
export const COUPON_CODE_SCHEMA={
  cupon:{attrs:['tamaño','proporcion'],props:[] as string[]},
  fondo:{attrs:['color','degradado','angulo','imagen','style'],props:['object-fit','object-position']},
  condiciones:{attrs:[] as string[],props:[] as string[]},
  campo:{attrs:['dato',...LAYER_ATTRS],props:TEXT_PROPS},
  texto:{attrs:['id',...LAYER_ATTRS],props:[...TEXT_PROPS,'transform']},
  imagen:{attrs:['id','recurso',...LAYER_ATTRS],props:['object-fit','object-position','border-radius','box-shadow','transform','opacity']},
  forma:{attrs:['id','tipo',...LAYER_ATTRS],props:['background','border','border-radius','border-style','stroke','stroke-width','box-shadow','transform','opacity']},
}
export const COUPON_CODE_VALUES:Record<string,string[]>={
  'tamaño':['estandar','grande'],dato:Object.values(COUPON_CODE_FIELDS),tipo:['rect','linea','elipse','estrella','sello'],
  'font-family':Object.values(COUPON_FONT_LABELS).map(label=>label.includes(' ')?`'${label}'`:label),'font-style':['normal','italic'],'text-decoration':['none','underline','line-through','underline line-through'],'text-transform':['none','uppercase'],'border-style':['solid','dashed','dotted'],'text-shadow':['none'],'box-shadow':['none'],'-webkit-text-stroke':['none'],transform:['rotate(0deg)'],'font-weight':['normal','bold'],'text-align':['left','center','right'],
  'object-fit':['contain','cover'],background:['none'],border:['none'],
}
type Tag=keyof typeof COUPON_CODE_SCHEMA
const TAGS=new Set(Object.keys(COUPON_CODE_SCHEMA))
const FIELD_BY_NAME=new Map(Object.entries(COUPON_CODE_FIELDS).map(([field,name])=>[name,field as CouponField]))
const ENTITIES=new Map([['lt','<'],['gt','>'],['amp','&'],['quot','"'],['apos',"'"]])
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CURVED=['background','border','box-shadow','transform','opacity']
const SHAPE_PROPS:Record<CouponShape,string[]>={rect:['background','border','border-radius','box-shadow','transform','opacity'],ellipse:CURVED,star:CURVED,badge:CURVED,line:['stroke','stroke-width','border-style','box-shadow','transform','opacity']}
const SHAPES=new Map<string,CouponShape>([['rect','rect'],['linea','line'],['elipse','ellipse'],['estrella','star'],['sello','badge']])
const SHAPE_NAMES:Record<CouponShape,string>={rect:'rect',line:'linea',ellipse:'elipse',star:'estrella',badge:'sello'}
const FONT_BY_NAME=new Map(Object.entries(COUPON_FONT_LABELS).flatMap(([id,label])=>[[label.toLowerCase(),id as CouponFontId],[id.toLowerCase(),id as CouponFontId]]))
const VARIANT_NAMES={bold:'negrita',italic:'cursiva',bolditalic:'negrita cursiva',normal:'regular'}

// Referencia, sugerencias y validador comparten los estilos del tipo de forma.
export function couponCodeStyleProperties(tag:string,shapeType?:string):string[]{
  if(tag==='forma')return SHAPE_PROPS[SHAPES.get(shapeType?.trim()??'')??'rect']
  return COUPON_CODE_SCHEMA[tag as Tag]?.props??[]
}

type Attr={value:string|null;from:number;to:number}
type Node={name:string;attrs:Map<string,Attr>;children:Node[];text:string|null;from:number;to:number}
class Failure extends Error{constructor(message:string,public from:number,public to:number){super(message)}}

function lineColumn(source:string,offset:number){
  let line=1,start=0
  for(let i=0;i<offset&&i<source.length;i++)if(source[i]==='\n'){line++;start=i+1}
  return{line,column:offset-start+1}
}

function decode(raw:string,from:number){
  let out='',i=0
  while(i<raw.length){
    const amp=raw.indexOf('&',i);if(amp<0){out+=raw.slice(i);break}
    out+=raw.slice(i,amp)
    const end=raw.indexOf(';',amp)
    if(end<0||end-amp>10)throw new Failure('Usa &amp; para escribir el signo &',from+amp,from+amp+1)
    const name=raw.slice(amp+1,end)
    if(name.startsWith('#')){
      const code=/^#x[0-9a-f]{1,6}$/i.test(name)?parseInt(name.slice(2),16):/^#[0-9]{1,7}$/.test(name)?Number(name.slice(1)):NaN
      if(!Number.isInteger(code)||code>0x10ffff||(code>=0xd800&&code<=0xdfff)||(code<32&&![9,10,13].includes(code)))throw new Failure(`Carácter no permitido: &${name};`,from+amp,from+end+1)
      out+=String.fromCodePoint(code)
    }else if(ENTITIES.has(name))out+=ENTITIES.get(name)
    else throw new Failure(`Entidad no permitida: &${name}; (usa &lt; &gt; &amp; &quot; o &apos;)`,from+amp,from+end+1)
    i=end+1
  }
  return out
}

// Tokenizador lineal: sin DTD, sin instrucciones de procesamiento, sin regex con retroceso sobre la entrada.
function read(source:string):Node{
  let i=0
  const nameChar=/[\p{L}\p{N}_.-]/u
  const ws=()=>{while(i<source.length&&/\s/.test(source[i]))i++}
  const misc=()=>{
    for(;;){
      ws()
      if(source.startsWith('<!--',i)){const end=source.indexOf('-->',i+4);if(end<0)throw new Failure('Comentario sin cerrar: falta -->',i,i+4);i=end+3;continue}
      if(source.startsWith('<!',i))throw new Failure('No se permiten declaraciones <!…> (DOCTYPE, ENTITY o CDATA)',i,i+2)
      if(source.startsWith('<?',i))throw new Failure('No se permiten instrucciones <?…?>',i,i+2)
      return
    }
  }
  const name=()=>{
    const start=i
    if(!/[\p{L}_]/u.test(source[i]??''))throw new Failure('Se esperaba el nombre de una etiqueta o atributo',i,i+1)
    while(i<source.length&&nameChar.test(source[i])&&i-start<64)i++
    return source.slice(start,i)
  }
  const element=(parent:string|null):Node=>{
    const from=i;i++
    const tag=name()
    if(!TAGS.has(tag))throw new Failure(`Etiqueta no permitida: <${tag}>${parent?` dentro de <${parent}>`:''}`,from,i)
    if(parent===null&&tag!=='cupon')throw new Failure('El código debe empezar con <cupon>',from,i)
    if(parent!==null&&tag==='cupon')throw new Failure('<cupon> solo puede aparecer una vez, como raíz',from,i)
    const attrs=new Map<string,Attr>()
    for(;;){
      const before=i;ws()
      if(source.startsWith('/>',i)||source[i]==='>')break
      if(i===before)throw new Failure(`Se esperaba > para cerrar <${tag}>`,i,i+1)
      const attrFrom=i,attr=name()
      if(attrs.has(attr))throw new Failure(`Atributo repetido: ${attr}`,attrFrom,i)
      const afterName=i;ws()
      let value:string|null=null
      if(source[i]!=='=')i=afterName
      else{
        i++;ws();const quote=source[i]
        if(quote!=='"'&&quote!=="'")throw new Failure(`El valor de ${attr} va entre comillas`,i,i+1)
        const start=++i
        while(i<source.length&&source[i]!==quote){if(source[i]==='<')throw new Failure(`No uses < dentro del atributo ${attr}`,i,i+1);i++}
        if(i>=source.length)throw new Failure(`Falta cerrar las comillas de ${attr}`,start-1,start)
        value=decode(source.slice(start,i),start);i++
      }
      attrs.set(attr,{value,from:attrFrom,to:i})
    }
    if(source.startsWith('/>',i)){i+=2;return{name:tag,attrs,children:[],text:null,from,to:i}}
    i++
    const children:Node[]=[];let text:string|null=null
    if(tag==='texto'||tag==='condiciones'){
      const start=i
      while(i<source.length&&source[i]!=='<')i++
      if(!source.startsWith('</',i))throw new Failure(`No se permiten etiquetas dentro de <${tag}>; escribe < como &lt;`,i,i+1)
      text=decode(source.slice(start,i),start)
    }else for(;;){
      misc()
      if(i>=source.length||source.startsWith('</',i))break
      if(source[i]!=='<')throw new Failure(tag==='cupon'?'Texto suelto dentro de <cupon>: usa <texto>':`<${tag}> no lleva contenido`,i,i+1)
      if(tag!=='cupon')throw new Failure(`<${tag}> no lleva etiquetas dentro`,i,i+1)
      children.push(element(tag))
    }
    const close=i
    if(!source.startsWith('</',i))throw new Failure(`Falta cerrar <${tag}> con </${tag}>`,from,from+tag.length+1)
    i+=2
    const closing=/[\p{L}_]/u.test(source[i]??'')?name():''
    ws()
    if(closing!==tag||source[i]!=='>')throw new Failure(`Falta cerrar <${tag}>: se esperaba </${tag}>${closing?` y se encontró </${closing}>`:''}`,close,i+1)
    i++
    return{name:tag,attrs,children,text,from,to:i}
  }
  misc()
  if(source[i]!=='<')throw new Failure('El código debe empezar con <cupon>',i,i+1)
  const root=element(null)
  misc()
  if(i<source.length)throw new Failure('Hay contenido después de </cupon>',i,i+1)
  return root
}

// Cada línea del texto se recorta; se descartan las líneas vacías del principio y del final.
const normalizeText=(text:string)=>{
  const lines=text.split(/\r?\n/).map(line=>line.trim())
  while(lines.length&&!lines[0])lines.shift()
  while(lines.length&&!lines.at(-1))lines.pop()
  return lines.join('\n')
}
// Porcentaje exacto: "51.5%" -> 515/1000, el mismo double que el literal .515.
const percent=(value:string,max=100)=>{
  const m=/^(\d{1,3})(?:\.(\d{1,4}))?%$/.exec(value.trim())
  if(!m)return null
  const decimals=m[2]??'',n=Number(m[1]+decimals)/10**(decimals.length+2)
  return n<=max/100?n:null
}
const hex=(value:string)=>{
  const v=value.trim().toLowerCase()
  if(/^#[0-9a-f]{6}$/.test(v))return v
  if(/^#[0-9a-f]{3}$/.test(v))return '#'+[...v.slice(1)].map(c=>c+c).join('')
  return null
}
const number=(value:string,min:number,max:number,unit='')=>{
  const m=new RegExp(`^(\\d{1,3}(?:\\.\\d{1,4})?)${unit?`(?:${unit})?`:''}$`).exec(value.trim())
  const n=m?Number(m[1]):NaN
  return n>=min&&n<=max?n:null
}

export function parseCouponCode(source:string,{requiredFields=[]}:{requiredFields?:CouponField[]}={}):CouponCodeResult{
  const errors:CouponCodeError[]=[]
  const report=(message:string,from:number,to:number)=>{if(errors.length<20)errors.push({message,...lineColumn(source,from),from,to:Math.max(to,from+1)})}
  if(source.length>MAX_COUPON_CODE){report(`El código supera ${MAX_COUPON_CODE.toLocaleString('es-GT').replace(/\D/g,' ')} caracteres`,MAX_COUPON_CODE,source.length);return{ok:false,errors}}
  for(let i=0;i<source.length;i++){
    const c=source.charCodeAt(i)
    if((c<32&&c!==9&&c!==10&&c!==13)||c===127){report('El código contiene un carácter de control no permitido',i,i+1);return{ok:false,errors}}
  }
  let root:Node
  try{root=read(source)}catch(e){if(e instanceof Failure){report(e.message,e.from,e.to);return{ok:false,errors}}throw e}

  const attrsOf=(node:Node)=>{
    const allowed=COUPON_CODE_SCHEMA[node.name as Tag].attrs
    for(const[key,attr]of node.attrs)if(!allowed.includes(key))report(`Atributo no permitido en <${node.name}>: ${key}${allowed.length?`. Usa: ${allowed.join(', ')}`:''}`,attr.from,attr.to)
    return(key:string,required=false)=>{
      const attr=node.attrs.get(key)
      if(!attr){if(required)report(`Falta ${key} en <${node.name}>`,node.from,node.from+node.name.length+1);return null}
      if(attr.value===null&&!['oculto','bloqueado'].includes(key)){report(`${key} necesita un valor entre comillas`,attr.from,attr.to);return null}
      return attr
    }
  }
  const styleOf=(node:Node,allowed:string[])=>{
    const attr=node.attrs.get('style'),props=new Map<string,string>()
    if(!attr||attr.value===null)return{get:()=>null as string|null,attr}
    for(const part of attr.value.split(';')){
      if(!part.trim())continue
      const colon=part.indexOf(':')
      if(colon<0){report(`Declaración sin dos puntos en style: ${part.trim()}`,attr.from,attr.to);continue}
      const prop=part.slice(0,colon).trim().toLowerCase(),value=part.slice(colon+1).trim()
      if(prop==='transform'&&node.name==='campo')report('Los campos no se pueden rotar: usa <texto> si necesitas un texto girado',attr.from,attr.to)
      else if(!allowed.includes(prop))report(`Propiedad no soportada en <${node.name}>: ${prop}. Usa: ${allowed.join(', ')}`,attr.from,attr.to)
      else if(props.has(prop))report(`Propiedad repetida en style: ${prop}`,attr.from,attr.to)
      else props.set(prop,value)
    }
    return{get:(prop:string)=>props.get(prop)??null,attr}
  }
  const invalid=(prop:string,hint:string,attr?:Attr)=>attr&&report(`${prop} no es válido: usa ${hint}`,attr.from,attr.to)
  const border=(value:string)=>{
    if(value.trim().toLowerCase()==='none')return{width:0,color:null,style:'solid' as const}
    const m=/^(\S+)\s+(solid|dashed|dotted)\s+(\S+)$/i.exec(value.trim()),width=m?number(m[1],0,20,'px'):null,color=m?hex(m[3]):null
    return width===null||!color?undefined:{width,color,style:m![2].toLowerCase() as 'solid'|'dashed'|'dotted'}
  }
  const signed=(value:string,min:number,max:number,unit='')=>{
    const m=new RegExp(`^(-?\\d{1,3}(?:\\.\\d{1,4})?)${unit?`(?:${unit})?`:''}$`).exec(value.trim())
    const n=m?Number(m[1]):NaN
    return n>=min&&n<=max?n:null
  }
  // rgba(r,g,b,a) o #hex: color de sombra más su opacidad.
  const paint=(value:string)=>{
    const c=hex(value);if(c)return{color:c,opacity:1}
    const m=/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d*(?:\.\d+)?)\s*\)$/i.exec(value.trim())
    if(!m||[m[1],m[2],m[3]].some(v=>Number(v)>255)||m[4]===''||Number(m[4])>1)return null
    return{color:'#'+[m[1],m[2],m[3]].map(v=>Number(v).toString(16).padStart(2,'0')).join(''),opacity:Number(m[4])}
  }
  const shadowOf=(value:string|null,prop:string,attr?:Attr):Shadow|null|undefined=>{
    if(value===null)return undefined
    if(value.trim().toLowerCase()==='none')return null
    const m=/^(\S+)\s+(\S+)\s+(.+)$/.exec(value.trim()),x=m?signed(m[1],-40,40,'px'):null,y=m?signed(m[2],-40,40,'px'):null,color=m?paint(m[3]):null
    if(x===null||y===null||!color){invalid(prop,'2px 2px rgba(0,0,0,0.4) o none (desplazamiento −40…40px)',attr);return undefined}
    return{x,y,...color}
  }
  const rotationOf=(value:string|null,attr?:Attr)=>{
    if(value===null)return undefined
    const m=/^rotate\(\s*(-?\d{1,3}(?:\.\d{1,2})?)deg\s*\)$/i.exec(value.trim()),n=m?Number(m[1]):NaN
    if(!(n>=-180&&n<=180)){invalid('transform','rotate(15deg) entre −180 y 180',attr);return undefined}
    return n
  }
  const gradientOf=(value:string,attr?:Attr):Gradient|null=>{
    const m=/^linear-gradient\(\s*(\d{1,3}(?:\.\d{1,2})?)deg\s*,\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s*(?:,\s*(#[0-9a-f]{3,6})\s*)?\)$/i.exec(value.trim())
    const angle=m?Number(m[1]):NaN,colors=m?[m[2],m[3],m[4]].filter(Boolean).map(c=>hex(c!)):[]
    if(!(angle>=0&&angle<=360)||colors.some(c=>!c)){invalid('background','linear-gradient(90deg, #rrggbb, #rrggbb)',attr);return null}
    return colors.length===3?{from:colors[0]!,via:colors[1]!,to:colors[2]!,angle}:{from:colors[0]!,to:colors[1]!,angle}
  }
  const fit=(value:string|null,fallback:'contain'|'cover',attr?:Attr)=>{
    if(value===null)return fallback
    if(value==='contain'||value==='cover')return value
    invalid('object-fit','contain o cover',attr);return fallback
  }
  const focal=(value:string|null,attr?:Attr)=>{
    if(value===null)return{focalX:.5,focalY:.5}
    const[x,y]=value.trim().split(/\s+/),fx=x!==undefined?percent(x):null,fy=y!==undefined?percent(y):null
    if(fx===null||fy===null){invalid('object-position','dos porcentajes, por ejemplo 50% 50%',attr);return{focalX:.5,focalY:.5}}
    return{focalX:fx,focalY:fy}
  }
  const opacity=(value:string|null,attr?:Attr)=>{
    if(value===null)return 1
    const n=number(value,0,1);if(n===null){invalid('opacity','un número entre 0 y 1',attr);return 1}
    return n
  }
  const textStyleOf=(node:Node)=>{
    const{get,attr}=styleOf(node,COUPON_CODE_SCHEMA[node.name as 'campo'|'texto'].props),style:TextStyle=textStyle()
    const font=get('font-family')
    if(font!==null){const f=FONT_BY_NAME.get(font.replace(/^['"]|['"]$/g,'').trim().toLowerCase());if(f)style.font=f;else invalid('font-family',Object.values(COUPON_FONT_LABELS).join(', '),attr)}
    const size=get('font-size');if(size!==null){const n=number(size,10,96,'px');if(n===null)invalid('font-size','un tamaño entre 10px y 96px',attr);else style.fontSize=n}
    const weight=get('font-weight');if(weight!==null){if(['bold','700'].includes(weight))style.bold=true;else if(!['normal','400'].includes(weight))invalid('font-weight','normal o bold',attr)}
    const color=get('color');if(color!==null){const c=hex(color);if(!c)invalid('color','un color #rrggbb',attr);else style.color=c}
    const align=get('text-align');if(align!==null){if(align==='left'||align==='center'||align==='right')style.align=align;else invalid('text-align','left, center o right',attr)}
    const line=get('line-height');if(line!==null){const n=number(line,1,2);if(n===null)invalid('line-height','un número entre 1 y 2',attr);else style.lineHeight=n}
    const padding=get('padding');if(padding!==null){const n=number(padding,0,30,'px');if(n===null)invalid('padding','un valor entre 0px y 30px',attr);else style.padding=n}
    const background=get('background');if(background!==null){if(background.trim().toLowerCase()==='none')style.background=null;else{const c=hex(background);if(!c)invalid('background','un color #rrggbb o none',attr);else style.background=c}}
    const b=get('border');if(b!==null){const parsed=border(b);if(!parsed)invalid('border','none o 1px solid #rrggbb (0–20px)',attr);else{style.borderWidth=parsed.width;style.borderColor=parsed.color}}
    const radius=get('border-radius');if(radius!==null){const n=number(radius,0,100,'px');if(n===null)invalid('border-radius','un valor entre 0px y 100px',attr);else style.radius=n}
    const fontStyle=get('font-style');if(fontStyle!==null){if(fontStyle==='italic')style.italic=true;else if(fontStyle==='normal')style.italic=false;else invalid('font-style','normal o italic',attr)}
    const decoration=get('text-decoration');if(decoration!==null){const tokens=decoration.trim().toLowerCase().split(/\s+/);if(tokens.join(' ')==='none'){style.underline=false;style.strike=false}else if(tokens.every(t=>t==='underline'||t==='line-through')){style.underline=tokens.includes('underline');style.strike=tokens.includes('line-through')}else invalid('text-decoration','none, underline, line-through o ambos',attr)}
    const transform=get('text-transform');if(transform!==null){if(transform==='uppercase')style.uppercase=true;else if(transform==='none')style.uppercase=false;else invalid('text-transform','none o uppercase',attr)}
    const spacing=get('letter-spacing');if(spacing!==null){const n=signed(spacing,-5,40,'px');if(n===null)invalid('letter-spacing','un valor entre −5px y 40px',attr);else style.letterSpacing=n}
    const stroke=get('-webkit-text-stroke');if(stroke!==null){if(stroke.trim().toLowerCase()==='none'){style.strokeColor=null;style.strokeWidth=0}else{const m=/^(\S+)\s+(\S+)$/.exec(stroke.trim()),w=m?number(m[1],0,10,'px'):null,c=m?hex(m[2]):null;if(w===null||!c)invalid('-webkit-text-stroke','1px #rrggbb o none (0–10px)',attr);else{style.strokeWidth=w;style.strokeColor=c}}}
    const shadow=shadowOf(get('text-shadow'),'text-shadow',attr);if(shadow!==undefined)style.shadow=shadow
    if(b!==null&&border(b)?.style!=='solid'&&border(b))report('En textos el borde es solid',attr!.from,attr!.to)
    const variant=style.bold&&style.italic?'bolditalic':style.bold?'bold':style.italic?'italic':'normal'
    if(!COUPON_FONT_VARIANTS[style.font].includes(variant))report(`${COUPON_FONT_LABELS[style.font]} no incluye ${VARIANT_NAMES[variant]}`,attr!.from,attr!.to)
    return{style,opacity:opacity(get('opacity'),attr),rotation:rotationOf(get('transform'),attr)}
  }

  const design:CouponDesign={printPreset:'standard',terms:'',background:{kind:'solid',color:'#0c203a'},elements:[]}
  const ranges:Record<string,CouponCodeRange>={},ids=new Map<string,Node>(),fields=new Map<CouponField,Node>(),pending:{element:CouponElement;node:Node;prefix:string}[]=[]
  const size=attrsOf(root)('tamaño')
  if(size){if(size.value==='grande')design.printPreset='large';else if(size.value!=='estandar')report('tamaño no es válido: usa estandar o grande',size.from,size.to)}
  // Proporción propia del cupón (ancho ÷ alto), la que toma de una imagen; sin ella, 1000 × 720.
  const ratio=attrsOf(root)('proporcion')
  if(ratio){const aspect=number(ratio.value??'',COUPON_ASPECT.min,COUPON_ASPECT.max);if(aspect===null)report('proporcion no es válida: usa un número entre 0.5 y 3 (ancho ÷ alto), por ejemplo 1.5',ratio.from,ratio.to);else design.aspect=aspect}
  let background:Node|null=null,terms:Node|null=null

  for(const node of root.children){
    if(node.name==='fondo'){
      if(background){report('Solo puede haber un <fondo>',node.from,node.to);continue}
      background=node
      const attr=attrsOf(node),color=attr('color'),gradient=attr('degradado'),image=attr('imagen')
      if([color,gradient,image].filter(Boolean).length!==1){report('<fondo> lleva exactamente uno de: color, degradado o imagen',node.from,node.to);continue}
      const{get,attr:style}=styleOf(node,COUPON_CODE_SCHEMA.fondo.props)
      if(style&&!image)report('style en <fondo> solo aplica a imagen',style.from,style.to)
      if(color){const c=hex(color.value!);if(!c)invalid('color','un color #rrggbb',color);else design.background={kind:'solid',color:c}}
      else if(gradient){
        const colors=gradient.value!.trim().split(/\s+/).map(hex),angulo=attr('angulo'),angle=angulo?number(angulo.value!,0,360):undefined
        if(colors.length<2||colors.length>3||colors.some(c=>!c))invalid('degradado','dos o tres colores, por ejemplo #0c203a #ff6f00',gradient)
        else if(angle===null)invalid('angulo','un número entre 0 y 360',angulo!)
        else if(colors.length===3&&angle===undefined)report('Con tres colores indica angulo, por ejemplo angulo="135"',gradient.from,gradient.to)
        else design.background={kind:'gradient',from:colors[0]!,...(colors.length===3?{via:colors[1]!}:{}),to:colors[colors.length-1]!,...(angle!==undefined?{angle}:{})}
      }
      else if(image){if(!UUID.test(image.value!))report('imagen debe ser el identificador de una imagen subida (no una URL)',image.from,image.to);else design.background={kind:'image',assetId:image.value!.toLowerCase(),fit:fit(get('object-fit'),'cover',style),...focal(get('object-position'),style)} as CouponBackground}
      continue
    }
    if(node.name==='condiciones'){
      if(terms){report('Solo puede haber un <condiciones>',node.from,node.to);continue}
      terms=node;attrsOf(node)
      design.terms=normalizeText(node.text??'')
      if(design.terms.length>500)report('Las condiciones admiten hasta 500 caracteres',node.from,node.to)
      continue
    }
    const attr=attrsOf(node)
    const box:Record<'x'|'y'|'width'|'height',number>={x:0,y:0,width:.1,height:.1}
    for(const[key,prop]of[['x','x'],['y','y'],['ancho','width'],['alto','height']]as const){
      const a=attr(key,true);if(!a)continue
      const n=percent(a.value!)
      if(n===null||((prop==='width'||prop==='height')&&n<=0))report(`${key} debe ser un porcentaje entre 0% y 100%, por ejemplo 5%`,a.from,a.to);else box[prop]=n
    }
    if(box.x+box.width>1.000000001)report('x + ancho no puede pasar de 100%',node.from,node.to)
    if(box.y+box.height>1.000000001)report('y + alto no puede pasar de 100%',node.from,node.to)
    const flag=(key:string)=>{const a=node.attrs.get(key);if(a&&a.value!==null)report(`${key} no lleva valor: escribe solo ${key}`,a.from,a.to);return!!a}
    const base={id:'',...box,visible:!flag('oculto'),locked:flag('bloqueado'),opacity:1}
    const id=attr('id')
    if(id){if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id.value!))report('id solo admite letras, números, - y _ (máx. 64)',id.from,id.to);else if(ids.has(id.value!))report(`id repetido: ${id.value}`,id.from,id.to);else{ids.set(id.value!,node);base.id=id.value!}}
    let element:CouponElement
    if(node.name==='campo'){
      const dato=attr('dato',true),field=dato?FIELD_BY_NAME.get(dato.value!.trim()):undefined
      if(dato&&!field)report(`dato no es válido: usa ${Object.values(COUPON_CODE_FIELDS).join(', ')}`,dato.from,dato.to)
      if(field&&fields.has(field))report(`El campo ${COUPON_CODE_FIELDS[field]} ya está en el cupón`,node.from,node.to)
      const{style,opacity:o}=textStyleOf(node)
      element={...base,id:'field-'+(field??'invalid'),opacity:o,kind:'field',field:field??'name',style}
      if(field)fields.set(field,node)
    }else if(node.name==='texto'){
      const text=normalizeText(node.text??'')
      if(text.length>1000)report('El texto admite hasta 1000 caracteres',node.from,node.to)
      const{style,opacity:o,rotation}=textStyleOf(node)
      element={...base,opacity:o,...(rotation!==undefined?{rotation}:{}),kind:'text',text,style}
    }else if(node.name==='imagen'){
      const asset=attr('recurso',true)
      if(asset&&!UUID.test(asset.value!))report('recurso debe ser el identificador de una imagen subida (no una URL)',asset.from,asset.to)
      const{get,attr:style}=styleOf(node,COUPON_CODE_SCHEMA.imagen.props)
      const rotation=rotationOf(get('transform'),style),shadow=shadowOf(get('box-shadow'),'box-shadow',style),radius=get('border-radius'),r=radius===null?undefined:number(radius,0,100,'px')
      if(r===null)invalid('border-radius','un valor entre 0px y 100px',style)
      element={...base,opacity:opacity(get('opacity'),style),...(rotation!==undefined?{rotation}:{}),kind:'image',assetId:(asset?.value??'').toLowerCase(),fit:fit(get('object-fit'),'contain',style),...focal(get('object-position'),style),...(r!=null?{radius:r}:{}),...(shadow!==undefined?{shadow}:{})}
    }else{
      const type=attr('tipo',true),shape=type?SHAPES.get(type.value!.trim()):undefined
      if(type&&!shape)report('tipo no es válido: usa rect, linea, elipse, estrella o sello',type.from,type.to)
      const{get,attr:style}=styleOf(node,couponCodeStyleProperties(node.name,type?.value??undefined))
      const rotation=rotationOf(get('transform'),style),shadow=shadowOf(get('box-shadow'),'box-shadow',style)
      const effects={...(rotation!==undefined?{rotation}:{}),...(shadow!==undefined?{shadow}:{})}
      if(shape==='line'){
        const stroke=get('stroke'),width=get('stroke-width'),color=stroke===null?'#0c203a':hex(stroke),w=width===null?2:number(width,0,20,'px'),dash=get('border-style')
        if(!color)invalid('stroke','un color #rrggbb',style)
        if(w===null)invalid('stroke-width','un valor entre 0px y 20px',style)
        if(dash!==null&&!['solid','dashed','dotted'].includes(dash))invalid('border-style','solid, dashed o dotted',style)
        element={...base,opacity:opacity(get('opacity'),style),...effects,kind:'shape',shape:'line',color:color??'#0c203a',borderColor:color??'#0c203a',borderWidth:w??2,radius:0,...(dash!==null?{borderStyle:dash as 'solid'|'dashed'|'dotted'}:{})}
      }else{
        const fill=get('background'),gradient=fill!==null&&/^linear-gradient/i.test(fill.trim())?gradientOf(fill,style):undefined
        const color=fill===null?'#ffffff':gradient?gradient.from:gradient===null?'#ffffff':hex(fill),b=get('border'),parsed=b===null?{width:0,color:null,style:undefined}:border(b),radius=get('border-radius'),r=radius===null?0:number(radius,0,100,'px')
        if(!color)invalid('background','un color #rrggbb o linear-gradient(90deg, #rrggbb, #rrggbb)',style)
        if(!parsed)invalid('border','none o 2px solid|dashed|dotted #rrggbb (0–20px)',style)
        if(r===null)invalid('border-radius','un valor entre 0px y 100px',style)
        element={...base,opacity:opacity(get('opacity'),style),...effects,kind:'shape',shape:shape??'rect',color:color??'#ffffff',borderColor:parsed?.color??color??'#ffffff',borderWidth:parsed?.width??0,radius:r??0,
          ...(parsed?.style&&b!==null&&b.trim().toLowerCase()!=='none'&&parsed.style!=='solid'?{borderStyle:parsed.style}:{}),...(gradient?{gradient}:{})}
      }
    }
    pending.push({element,node,prefix:node.name})
  }
  if(!background)report('Falta <fondo>: por ejemplo <fondo color="#0c203a" />',root.from,root.from+7)
  // Ids legibles para capas sin id: texto-1, imagen-1, forma-1…
  for(const item of pending){
    if(!item.element.id){let n=1;while(ids.has(`${item.prefix}-${n}`))n++;item.element.id=`${item.prefix}-${n}`;ids.set(item.element.id,item.node)}
    design.elements.push(item.element);ranges[item.element.id]=item.node
  }
  if(design.elements.length>30)report('El cupón admite hasta 30 capas',root.from,root.from+7)
  if(new Set(design.elements.flatMap(e=>e.kind==='image'?[e.assetId]:[]).concat(design.background.kind==='image'?[design.background.assetId]:[])).size>5)report('El cupón admite hasta 5 imágenes propias',root.from,root.from+7)
  for(const field of new Set<CouponField>(['code','benefit',...requiredFields])){
    const node=fields.get(field),element=design.elements.find(e=>e.kind==='field'&&e.field===field)
    const name=COUPON_CODE_FIELDS[field]
    if(!node||!element)report(`La promoción requiere mostrar <campo dato="${name}">`,root.from,root.from+7)
    else if(!element.visible||element.opacity!==1)report(`<campo dato="${name}"> es obligatorio: no puede estar oculto ni transparente`,node.from,node.to)
  }
  if(errors.length)return{ok:false,errors}
  try{parseCouponDesign(design)}catch(e){report(e instanceof Error?e.message:'Diseño no válido',root.from,root.from+7);return{ok:false,errors}}
  return{ok:true,design,ranges:Object.fromEntries(Object.entries(ranges).map(([id,node])=>[id,{from:(node as unknown as Node).from,to:(node as unknown as Node).to}]))}
}

const escapeText=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const num=(n:number)=>String(Math.round(n*100)/100)
const pct=(units:number)=>String(units/100)+'%'
const units=(fraction:number)=>Math.round(fraction*10000)

function textStyleCss(s:TextStyle,opacity:number,rotation?:number){
  const d=textStyle(),parts:string[]=[]
  const label=COUPON_FONT_LABELS[s.font]
  if(s.font!==d.font)parts.push(`font-family: ${label.includes(' ')?`'${label}'`:label}`)
  if(s.fontSize!==d.fontSize)parts.push(`font-size: ${num(s.fontSize)}px`)
  if(s.bold)parts.push('font-weight: bold')
  if(s.color.toLowerCase()!==d.color)parts.push(`color: ${s.color.toLowerCase()}`)
  if(s.align!==d.align)parts.push(`text-align: ${s.align}`)
  if(s.lineHeight!==d.lineHeight)parts.push(`line-height: ${num(s.lineHeight)}`)
  if(s.padding)parts.push(`padding: ${num(s.padding)}px`)
  if(s.background)parts.push(`background: ${s.background.toLowerCase()}`)
  if(s.borderColor)parts.push(`border: ${num(s.borderWidth)}px solid ${s.borderColor.toLowerCase()}`)
  if(s.radius)parts.push(`border-radius: ${num(s.radius)}px`)
  if(s.italic)parts.push('font-style: italic')
  const decoration=[...(s.underline?['underline']:[]),...(s.strike?['line-through']:[])]
  if(decoration.length)parts.push(`text-decoration: ${decoration.join(' ')}`)
  if(s.uppercase)parts.push('text-transform: uppercase')
  if(s.letterSpacing)parts.push(`letter-spacing: ${num(s.letterSpacing)}px`)
  if(s.strokeColor)parts.push(`-webkit-text-stroke: ${num(s.strokeWidth??0)}px ${s.strokeColor.toLowerCase()}`)
  if(s.shadow)parts.push(`text-shadow: ${shadowCss(s.shadow)}`)
  if(rotation)parts.push(`transform: rotate(${num(rotation)}deg)`)
  if(opacity!==1)parts.push(`opacity: ${num(opacity)}`)
  return parts.join('; ')
}
function shadowCss(shadow:Shadow){
  const rgb=[1,3,5].map(i=>parseInt(shadow.color.slice(i,i+2),16))
  return `${num(shadow.x)}px ${num(shadow.y)}px ${shadow.opacity===1?shadow.color.toLowerCase():`rgba(${rgb.join(',')},${num(shadow.opacity)})`}`
}
const gradientCss=(g:Gradient)=>`linear-gradient(${num(g.angle)}deg, ${[g.from,...(g.via?[g.via]:[]),g.to].map(c=>c.toLowerCase()).join(', ')})`
const effectsCss=(e:{rotation?:number;shadow?:Shadow|null})=>[...(e.shadow?[`box-shadow: ${shadowCss(e.shadow)}`]:[]),...(e.rotation?[`transform: rotate(${num(e.rotation)}deg)`]:[])]
const focalCss=(fit:string,x:number,y:number)=>[`object-fit: ${fit}`,...(x!==.5||y!==.5?[`object-position: ${pct(units(x))} ${pct(units(y))}`]:[])]

// Forma canónica: idempotente y sin desbordar el cupón al redondear a 0.01%.
export function serializeCouponDesign(design:CouponDesign):string{
  const lines=[`<cupon tamaño="${design.printPreset==='large'?'grande':'estandar'}"${design.aspect?` proporcion="${design.aspect}"`:''}>`],bg=design.background
  if(bg.kind==='solid')lines.push(`  <fondo color="${bg.color.toLowerCase()}" />`)
  else if(bg.kind==='gradient')lines.push(`  <fondo degradado="${[bg.from,...(bg.via?[bg.via]:[]),bg.to].map(c=>c.toLowerCase()).join(' ')}"${bg.angle!==undefined?` angulo="${num(bg.angle)}"`:''} />`)
  else lines.push(`  <fondo imagen="${bg.assetId}" style="${focalCss(bg.fit,bg.focalX,bg.focalY).join('; ')}" />`)
  const block=(tag:string,head:string,text:string)=>{
    const body=text.split('\n')
    return body.length>1?[`${head}>`,...body.map(line=>line?'    '+escapeText(line):''),`  </${tag}>`]:[`${head}>${escapeText(text)}</${tag}>`]
  }
  if(design.terms)lines.push(...block('condiciones','  <condiciones',design.terms))
  for(const e of design.elements){
    const tag=e.kind==='field'?'campo':e.kind==='text'?'texto':e.kind==='image'?'imagen':'forma'
    const x=units(e.x),y=units(e.y),w=Math.max(1,Math.min(units(e.width),10000-x)),h=Math.max(1,Math.min(units(e.height),10000-y))
    const attrs=[e.kind==='field'?`dato="${COUPON_CODE_FIELDS[e.field]}"`:`id="${e.id}"`]
    if(e.kind==='image')attrs.push(`recurso="${e.assetId}"`)
    if(e.kind==='shape')attrs.push(`tipo="${SHAPE_NAMES[e.shape]}"`)
    attrs.push(`x="${pct(x)}"`,`y="${pct(y)}"`,`ancho="${pct(w)}"`,`alto="${pct(h)}"`)
    if(!e.visible)attrs.push('oculto')
    if(e.locked)attrs.push('bloqueado')
    const css=e.kind==='field'||e.kind==='text'?textStyleCss(e.style,e.opacity,e.kind==='text'?e.rotation:undefined)
      :e.kind==='image'?[...focalCss(e.fit,e.focalX,e.focalY),...(e.radius?[`border-radius: ${num(e.radius)}px`]:[]),...effectsCss(e),...(e.opacity!==1?[`opacity: ${num(e.opacity)}`]:[])].join('; ')
      :[...(e.shape==='line'
          ?[`stroke: ${e.color.toLowerCase()}`,`stroke-width: ${num(e.borderWidth)}px`,...(e.borderStyle&&e.borderStyle!=='solid'?[`border-style: ${e.borderStyle}`]:[])]
          :[`background: ${e.gradient?gradientCss(e.gradient):e.color.toLowerCase()}`,...(e.borderWidth||e.borderColor.toLowerCase()!==e.color.toLowerCase()?[`border: ${num(e.borderWidth)}px ${e.borderStyle??'solid'} ${e.borderColor.toLowerCase()}`]:[]),...(e.shape==='rect'&&e.radius?[`border-radius: ${num(e.radius)}px`]:[])]),
        ...effectsCss(e),...(e.opacity!==1?[`opacity: ${num(e.opacity)}`]:[])].join('; ')
    const head=`  <${tag} ${attrs.join(' ')}`+(css?`\n${' '.repeat(tag.length+4)}style="${css}"`:'')
    if(e.kind==='text')lines.push(...block('texto',head,e.text))
    else lines.push(head+' />')
  }
  lines.push('</cupon>')
  return lines.join('\n')
}

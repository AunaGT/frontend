import type {ReactNode} from 'react'
import {Bold,Italic,Underline,Strikethrough,CaseUpper,AlignLeft,AlignCenter,AlignRight,type LucideIcon} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select'
import {COUPON_FONTS,COUPON_FONT_IDS,supportsVariant,type CouponFontId} from './couponFonts'
import type {CouponElement,Shadow,TextStyle} from './couponDesign'

type GradientValue={from:string;to:string;via?:string;angle?:number}
const SHADOW:Shadow={x:4,y:4,color:'#000000',opacity:.35}
const numeric=(label:string,value:number,change:(n:number)=>void,min=0,max=100,step=1,disabled=false)=><Label className="grid gap-1 text-xs">{label}<Input type="number" aria-label={label} value={Math.round(value*100)/100} min={min} max={max} step={step} disabled={disabled} onChange={event=>{if(event.target.value!=='')change(Number(event.target.value))}}/></Label>
const color=(label:string,value:string,change:(s:string)=>void,disabled=false)=><Label className="grid gap-1 text-xs">{label}<Input type="color" aria-label={label} value={value} disabled={disabled} onChange={event=>change(event.target.value)}/></Label>
const check=(label:string,checked:boolean,change:(on:boolean)=>void,disabled=false)=><Label className="flex items-center gap-2 text-xs"><Checkbox aria-label={label} checked={checked} disabled={disabled} onCheckedChange={v=>change(v===true)}/>{label}</Label>
const section=(title:string,children:ReactNode,open=false)=><details className="coupon-props-section" open={open}><summary>{title}</summary><div className="coupon-props-body">{children}</div></details>
const pair=(a:ReactNode,b:ReactNode)=><div className="grid grid-cols-2 items-end gap-2">{a}{b}</div>

// Degradado compartido por formas y fondo; en el fondo, sin ángulo se dibuja el degradado clásico de la fase 1.
export function GradientFields({value:g,onChange,disabled=false,classic=false}:{value:GradientValue;onChange:(g:GradientValue)=>void;disabled?:boolean;classic?:boolean}){
  const {via:_via,...withoutVia}=g,{angle:_angle,...withoutAngle}=withoutVia
  return <>
    {pair(color('Color inicial',g.from,from=>onChange({...g,from}),disabled),color('Color final',g.to,to=>onChange({...g,to}),disabled))}
    {check('Color intermedio',!!g.via,on=>onChange(on?{...g,via:'#ffffff',angle:g.angle??135}:withoutVia),disabled)}
    {g.via&&color('Color intermedio (tono)',g.via,via=>onChange({...g,via}),disabled)}
    <Label className="grid gap-1 text-xs">Ángulo (°)<Input type="number" aria-label="Ángulo (°)" min={0} max={360} placeholder={classic?'Clásico':undefined} value={g.angle??''} disabled={disabled} onChange={event=>{
      if(event.target.value==='')return void(classic&&onChange(withoutAngle))
      onChange({...g,angle:Math.min(360,Math.max(0,Number(event.target.value)))})
    }}/></Label>
  </>
}

function ShadowFields({value,onChange,disabled}:{value:Shadow|null|undefined;onChange:(s:Shadow|null)=>void;disabled:boolean}){
  return <>
    {check('Sombra',!!value,on=>onChange(on?SHADOW:null),disabled)}
    {value&&<>{pair(numeric('Sombra X',value.x,x=>onChange({...value,x}),-40,40,1,disabled),numeric('Sombra Y',value.y,y=>onChange({...value,y}),-40,40,1,disabled))}
      {pair(color('Color de sombra',value.color,c=>onChange({...value,color:c}),disabled),numeric('Opacidad de sombra (%)',value.opacity*100,n=>onChange({...value,opacity:n/100}),0,100,5,disabled))}</>}
  </>
}

export function CouponProperties({element:e,onChange,disabled=false}:{element:CouponElement;onChange:(patch:Partial<CouponElement>)=>void;disabled?:boolean}){
  const s=e.kind==='field'||e.kind==='text'?e.style:null
  const style=(patch:Partial<TextStyle>)=>s&&onChange({style:{...s,...patch}} as Partial<CouponElement>)
  const patch=(p:Record<string,unknown>)=>onChange(p as Partial<CouponElement>)
  const toggle=(key:'bold'|'italic'|'underline'|'strike'|'uppercase',label:string,Icon:LucideIcon,missing=false)=>{
    const on=!!s?.[key]
    return <Button key={key} type="button" size="icon" className="h-9 w-9" variant={on?'secondary':'outline'} aria-label={label} aria-pressed={on} title={missing&&s?`${COUPON_FONTS[s.font].label} no incluye ${label.toLowerCase()}`:label} disabled={disabled||missing&&!on} onClick={()=>style({[key]:!on})}><Icon className="h-4 w-4" aria-hidden="true"/></Button>
  }
  const align=(value:TextStyle['align'],label:string,Icon:LucideIcon)=><Button key={value} type="button" size="icon" className="h-9 w-9" variant={s?.align===value?'secondary':'outline'} aria-label={label} aria-pressed={s?.align===value} disabled={disabled} onClick={()=>style({align:value})}><Icon className="h-4 w-4" aria-hidden="true"/></Button>

  const text=s&&section('Texto',<>
    {e.kind==='text'&&<Label className="grid gap-1 text-xs">Contenido<Textarea value={e.text} maxLength={1000} disabled={disabled} onChange={event=>patch({text:event.target.value})}/></Label>}
    <Label className="grid gap-1 text-xs">Fuente<Select value={s.font} disabled={disabled} onValueChange={id=>{
      // Una fuente sin negrita o cursiva las apaga: nunca se simulan.
      const font=id as CouponFontId,bold=s.bold&&supportsVariant(font,'bold')
      style({font,bold,italic:!!s.italic&&supportsVariant(font,bold?'bolditalic':'italic')})
    }}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{COUPON_FONT_IDS.map(id=><SelectItem key={id} value={id} style={{fontFamily:COUPON_FONTS[id].css}}>{COUPON_FONTS[id].label}</SelectItem>)}</SelectContent></Select></Label>
    {pair(numeric('Tamaño',s.fontSize,fontSize=>style({fontSize}),10,96,1,disabled),numeric('Interlineado',s.lineHeight,lineHeight=>style({lineHeight}),1,2,.1,disabled))}
    <div className="flex flex-wrap gap-1" role="group" aria-label="Estilo del texto">
      {toggle('bold','Negrita',Bold,!supportsVariant(s.font,s.italic?'bolditalic':'bold'))}{toggle('italic','Cursiva',Italic,!supportsVariant(s.font,s.bold?'bolditalic':'italic'))}
      {toggle('underline','Subrayado',Underline)}{toggle('strike','Tachado',Strikethrough)}{toggle('uppercase','Mayúsculas',CaseUpper)}
    </div>
    <div className="flex gap-1" role="group" aria-label="Alineación del texto">{align('left','Texto a la izquierda',AlignLeft)}{align('center','Texto centrado',AlignCenter)}{align('right','Texto a la derecha',AlignRight)}</div>
    {pair(color('Color del texto',s.color,c=>style({color:c}),disabled),numeric('Espaciado entre letras',s.letterSpacing??0,letterSpacing=>style({letterSpacing}),-5,40,.5,disabled))}
  </>,true)

  const fill=s?section('Relleno y borde',<>
    {check('Fondo de texto',!!s.background,on=>style({background:on?'#0c203a':null}),disabled)}
    {s.background&&color('Color de fondo',s.background,background=>style({background}),disabled)}
    {check('Borde',!!s.borderColor,on=>style({borderColor:on?'#0c203a':null,borderWidth:on?1:0}),disabled)}
    {s.borderColor&&color('Color de borde',s.borderColor,borderColor=>style({borderColor}),disabled)}
    {pair(numeric('Grosor',s.borderWidth,borderWidth=>style({borderWidth}),0,20,1,disabled),numeric('Redondeado',s.radius,radius=>style({radius}),0,100,1,disabled))}
    {numeric('Espaciado interno',s.padding,padding=>style({padding}),0,30,1,disabled)}
  </>):e.kind==='shape'?section('Relleno y borde',<>
    {e.shape!=='line'&&check('Degradado',!!e.gradient,on=>patch({gradient:on?{from:e.color,to:'#ffd166',angle:90}:null}),disabled)}
    {e.shape!=='line'&&e.gradient?<GradientFields value={e.gradient} disabled={disabled} onChange={g=>patch({gradient:g,color:g.from})}/>:color(e.shape==='line'?'Color de la línea':'Color de relleno',e.color,c=>patch({color:c}),disabled)}
    {e.shape!=='line'&&color('Color de borde',e.borderColor,borderColor=>patch({borderColor}),disabled)}
    {pair(numeric('Grosor',e.borderWidth,borderWidth=>patch({borderWidth}),0,20,1,disabled),e.shape==='rect'?numeric('Redondeado',e.radius,radius=>patch({radius}),0,100,1,disabled):null)}
    <Label className="grid gap-1 text-xs">Trazo<Select value={e.borderStyle??'solid'} disabled={disabled} onValueChange={borderStyle=>patch({borderStyle})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="solid">Continuo</SelectItem><SelectItem value="dashed">Discontinuo</SelectItem><SelectItem value="dotted">Punteado</SelectItem></SelectContent></Select></Label>
  </>,true):null

  const image=e.kind==='image'&&section('Imagen',<>
    <Label className="grid gap-1 text-xs">Ajuste<Select value={e.fit} disabled={disabled} onValueChange={fit=>patch({fit})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="contain">Imagen completa</SelectItem><SelectItem value="cover">Llenar / recortar</SelectItem></SelectContent></Select></Label>
    {pair(numeric('Foco horizontal (%)',e.focalX*100,n=>patch({focalX:n/100}),0,100,1,disabled),numeric('Foco vertical (%)',e.focalY*100,n=>patch({focalY:n/100}),0,100,1,disabled))}
    {numeric('Redondeado',e.radius??0,radius=>patch({radius}),0,100,1,disabled)}
  </>,true)

  const effects=section('Efectos',<>
    {numeric('Opacidad (%)',e.opacity*100,n=>onChange({opacity:n/100}),0,100,1,disabled)}
    {s&&<>{check('Contorno',!!s.strokeColor&&!!s.strokeWidth,on=>style({strokeColor:on?'#ffffff':null,strokeWidth:on?1:0}),disabled)}
      {s.strokeColor&&!!s.strokeWidth&&pair(color('Color de contorno',s.strokeColor,strokeColor=>style({strokeColor}),disabled),numeric('Grosor de contorno',s.strokeWidth,strokeWidth=>style({strokeWidth}),.5,10,.5,disabled))}
      <ShadowFields value={s.shadow} disabled={disabled} onChange={shadow=>style({shadow})}/></>}
    {(e.kind==='shape'||e.kind==='image')&&<ShadowFields value={e.shadow} disabled={disabled} onChange={shadow=>patch({shadow})}/>}
  </>)

  const position=section('Posición y tamaño',<>
    <div className="grid grid-cols-2 gap-2">{(['x','y','width','height']as const).map(key=><div key={key}>{numeric({x:'X (%)',y:'Y (%)',width:'Ancho (%)',height:'Alto (%)'}[key],e[key]*100,n=>onChange({[key]:n/100}),key==='width'||key==='height'?2:0,100,.1,disabled)}</div>)}</div>
    {/* Los campos no rotan: las comprobaciones de legibilidad suponen cajas alineadas. */}
    {e.kind!=='field'&&numeric('Rotación (°)',e.rotation??0,rotation=>onChange({rotation}),-180,180,1,disabled)}
  </>)

  return <div className="coupon-props">{text}{image}{fill}{effects}{position}</div>
}

import {useEffect,useState,type ComponentProps} from 'react'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Button} from '@/components/ui/button'
import {COUPON_FONT_LABELS} from '@/modules/promotions/coupons/couponDesign'
import type {LabelElement,LabelDesign,TextStyle} from './types'
export function LabelNumberInput({value,onCommit,...props}:Omit<ComponentProps<typeof Input>,'value'|'onChange'> & {value:number;onCommit:(value:number)=>void}){
  const [draft,setDraft]=useState(String(value))
  useEffect(()=>setDraft(String(value)),[value])
  const commit=()=>{const number=Number(draft);if(draft.trim()&&Number.isFinite(number))onCommit(number);setDraft(String(value))}
  return <Input {...props} type="number" value={draft} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){setDraft(String(value));event.currentTarget.blur()}}}/>
}
export function BarcodeLabelProperties({element:e,design,onChange}:{element:LabelElement;design:LabelDesign;onChange:(patch:Partial<LabelElement>)=>void}){
  const changeStyle=(patch:Partial<TextStyle>)=>{if(e.kind==='text'||e.kind==='field')onChange({style:{...e.style,...patch}} as Partial<LabelElement>)}
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">{(['x','y','width','height'] as const).map(k=><Label key={k} className="space-y-1 text-xs">{{x:'Posición X',y:'Posición Y',width:'Ancho',height:'Alto'}[k]} (mm)<LabelNumberInput step="0.1" disabled={e.locked} value={Number((e[k]*(k==='x'||k==='width'?design.widthMm:design.heightMm)).toFixed(2))} onCommit={value=>onChange({[k]:value/(k==='x'||k==='width'?design.widthMm:design.heightMm)})}/></Label>)}</div>
    {(e.kind==='text'||e.kind==='field')&&<>
      {e.kind==='text'&&<Label className="block space-y-1">Texto<Input disabled={e.locked} value={e.text} onChange={event=>onChange({text:event.target.value} as Partial<LabelElement>)}/></Label>}
      <Label className="block space-y-1">Fuente<select className="auna-control auna-control-select" disabled={e.locked} value={e.style.font} onChange={event=>changeStyle({font:event.target.value as TextStyle['font'],bold:false,italic:false})}>{Object.entries(COUPON_FONT_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></Label>
      <div className="grid grid-cols-2 gap-2"><Label className="space-y-1">Tamaño (pt)<LabelNumberInput min="6" max="36" disabled={e.locked} value={e.style.fontSize} onCommit={value=>changeStyle({fontSize:value})}/></Label><Label className="space-y-1">Color<Input type="color" disabled={e.locked||e.kind==='field'&&e.field==='barcode'} value={e.style.color} onChange={event=>changeStyle({color:event.target.value})}/></Label></div>
      <div className="flex flex-wrap gap-1">{(['left','center','right'] as const).map(align=><Button key={align} size="sm" variant={e.style.align===align?'default':'outline'} disabled={e.locked} onClick={()=>changeStyle({align})}>{{left:'Izq.',center:'Centro',right:'Der.'}[align]}</Button>)}<Button size="sm" variant={e.style.bold?'default':'outline'} disabled={e.locked} onClick={()=>changeStyle({bold:!e.style.bold})}>Negrita</Button><Button size="sm" variant={e.style.italic?'default':'outline'} disabled={e.locked} onClick={()=>changeStyle({italic:!e.style.italic})}>Cursiva</Button></div>
      <div className="grid grid-cols-2 gap-2"><Label className="space-y-1">Borde (pt)<LabelNumberInput min="0" max="3" step="0.25" disabled={e.locked||e.kind==='field'&&e.field==='barcode'} value={e.style.borderWidth} onCommit={value=>changeStyle({borderWidth:value,borderColor:'#111111'})}/></Label><Label className="space-y-1">Fondo<Input type="color" disabled={e.locked||e.kind==='field'&&e.field==='barcode'} value={e.style.background||'#ffffff'} onChange={event=>changeStyle({background:event.target.value})}/></Label></div>
    </>}
    {e.kind==='shape'&&<div className="grid grid-cols-2 gap-2"><Label>Relleno<Input type="color" disabled={e.locked} value={e.color} onChange={event=>onChange({color:event.target.value} as Partial<LabelElement>)}/></Label><Label>Borde<LabelNumberInput min="0" max="3" step="0.25" disabled={e.locked} value={e.borderWidth} onCommit={value=>onChange({borderWidth:value} as Partial<LabelElement>)}/></Label></div>}
    {e.kind==='barcode'&&<p className="text-xs text-muted-foreground">Las barras y su zona blanca están protegidas. El tamaño mínimo depende del valor y el tipo de código.</p>}
  </div>
}

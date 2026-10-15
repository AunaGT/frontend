import type {PointerEvent,KeyboardEvent} from 'react'
import {COUPON_FONTS} from '@/modules/promotions/coupons/couponFonts'
import {PT_MM} from './labelScene'
import type {LabelScene} from './labelScene'
import type {LabelDesign} from './types'
export function BarcodeLabelCanvas({scene,design,selection=null,zoom=1,onSelect,onBeginMove,onBeginResize,onPointerMove,onPointerUp,onPointerCancel,onKeyDown}:{scene:LabelScene|null;design:LabelDesign;selection?:string|null;zoom?:number;onSelect?:(id:string)=>void;onBeginMove?:(id:string,e:PointerEvent<SVGGElement>)=>void;onBeginResize?:(id:string,e:PointerEvent<SVGRectElement>)=>void;onPointerMove?:(e:PointerEvent<SVGSVGElement>)=>void;onPointerUp?:()=>void;onPointerCancel?:()=>void;onKeyDown?:(e:KeyboardEvent<SVGSVGElement>)=>void}){
  return <svg role="img" aria-label="Etiqueta de código de barras" tabIndex={onSelect?0:undefined} viewBox={`0 0 ${design.widthMm} ${design.heightMm}`} className="barcode-label-canvas" style={{width:design.widthMm*5*zoom,maxWidth:'none',touchAction:onSelect?'none':'auto'}} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}>
    <rect width={design.widthMm} height={design.heightMm} fill="#fff"/>
    {scene?.nodes.map(n=><g key={n.id}>
      {n.kind==='barcode'?<><rect x={n.x} y={n.y} width={n.width} height={n.height} fill="#fff"/>{n.bars.map((b,i)=><rect key={i} x={n.x+b.x} y={n.y+b.y} width={b.width} height={b.height} fill="#000"/>)}</>:n.kind==='shape'?n.shape==='ellipse'?<ellipse cx={n.x+n.width/2} cy={n.y+n.height/2} rx={n.width/2} ry={n.height/2} fill={n.color} stroke={n.borderColor} strokeWidth={n.borderWidth*PT_MM}/>:n.shape==='line'?<line x1={n.x} y1={n.y} x2={n.x+n.width} y2={n.y+n.height} stroke={n.borderColor} strokeWidth={Math.max(.1,n.borderWidth*PT_MM)}/>:<rect x={n.x} y={n.y} width={n.width} height={n.height} fill={n.color} stroke={n.borderColor} strokeWidth={n.borderWidth*PT_MM}/>:<>
        {n.style.background&&<rect x={n.x} y={n.y} width={n.width} height={n.height} rx={n.style.radius*PT_MM} fill={n.style.background}/>}
        {n.style.borderColor&&n.style.borderWidth>0&&<rect x={n.x} y={n.y} width={n.width} height={n.height} rx={n.style.radius*PT_MM} fill="none" stroke={n.style.borderColor} strokeWidth={n.style.borderWidth*PT_MM}/>}
        {n.lines.map((text,i)=><text key={i} x={n.style.align==='center'?n.x+n.width/2:n.style.align==='right'?n.x+n.width-n.style.padding*PT_MM:n.x+n.style.padding*PT_MM} y={n.y+n.style.padding*PT_MM+n.style.fontSize*PT_MM*.82+i*n.style.fontSize*n.style.lineHeight*PT_MM} fontFamily={COUPON_FONTS[n.style.font]?.css} fontWeight={n.style.bold?700:400} fontStyle={n.style.italic?'italic':'normal'} fontSize={n.style.fontSize*PT_MM} fill={n.style.color} textAnchor={n.style.align==='center'?'middle':n.style.align==='right'?'end':'start'} letterSpacing={(n.style.letterSpacing||0)*PT_MM} textDecoration={[n.style.underline?'underline':'',n.style.strike?'line-through':''].filter(Boolean).join(' ')||undefined}>{text}</text>)}
      </>}
    </g>)}
    {onSelect&&design.elements.filter(e=>e.visible).map(e=><g key={e.id} data-layer={e.id} onPointerDown={event=>{onSelect(e.id);onBeginMove?.(e.id,event)}}>
      <rect x={e.x*design.widthMm} y={e.y*design.heightMm} width={e.width*design.widthMm} height={e.height*design.heightMm} fill="transparent" stroke={selection===e.id?'#f97316':'none'} strokeWidth=".3"/>
      {selection===e.id&&!e.locked&&<rect aria-label="Redimensionar capa" x={(e.x+e.width)*design.widthMm-1.5} y={(e.y+e.height)*design.heightMm-1.5} width="3" height="3" fill="#f97316" onPointerDown={event=>{event.stopPropagation();onBeginResize?.(e.id,event)}}/>}
    </g>)}
  </svg>
}

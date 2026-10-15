import {useId,type PointerEvent,type KeyboardEvent} from 'react'
import type {CouponScene,SceneNode} from './couponPresentation'
import {couponImagePlacement,dashPattern,gradientLine,gradientStops,shapePoints} from './couponPresentation'
import {COUPON_FONTS} from './couponFonts'
import type {Shadow} from './couponDesign'
import './couponEditor.css'
export type CouponAsset={id:string;url:string;expiresAt:string;width:number;height:number}
export type CouponAssets=Map<string,CouponAsset>
interface Props{
  scene:CouponScene;assets?:CouponAssets;logoUrl?:string;selectedId?:string|null;zoom?:number;previewOnly?:boolean;
  guides?:{axis:'x'|'y';position:number}[];
  onSelect?:(id:string)=>void;onBeginMove?:(id:string,e:PointerEvent<SVGGElement>)=>void;onBeginResize?:(id:string,e:PointerEvent<SVGRectElement>)=>void;
  onPointerMove?:(e:PointerEvent<SVGSVGElement>)=>void;onPointerUp?:(e:PointerEvent<SVGSVGElement>)=>void;onPointerCancel?:()=>void;onKeyDown?:(e:KeyboardEvent<SVGSVGElement>)=>void
}
type Shape=Extract<SceneNode,{kind:'shape'}>
type Text=Extract<SceneNode,{kind:'text'}>
export function CouponCanvas({scene,assets=new Map(),logoUrl,selectedId,zoom=1,previewOnly=false,guides=[],onSelect,onBeginMove,onBeginResize,onPointerMove,onPointerUp,onPointerCancel,onKeyDown}:Props){
  const uid=useId().replace(/:/g,''),gradient=uid+'-gradient',fill=(id:string)=>`${uid}-g-${id}`
  // Sombra: copia desplazada sin difuminado, igual que en el PDF.
  const shadowOf=(shadow:Shadow|null|undefined,content:(dx:number,dy:number,color:string)=>JSX.Element)=>shadow?<g data-shadow="" opacity={shadow.opacity}>{content(shadow.x,shadow.y,shadow.color)}</g>:null
  const image=(node:SceneNode,source:string|undefined,fit:string,fx=.5,fy=.5)=>{
    const id=node.kind==='image'&&'assetId'in node.source?node.source.assetId:node.kind==='background'&&node.fill.kind==='image'?node.fill.assetId:null
    const asset=id?assets.get(id):null,box=asset?couponImagePlacement(node,asset,fit as 'contain'|'cover',fx,fy):node
    return source?<image href={source} x={box.x} y={box.y} width={box.width} height={box.height} preserveAspectRatio={asset?'none':`xMidYMid ${fit==='cover'?'slice':'meet'}`} clipPath={`url(#${uid}-${node.id})`}/>:null
  }
  const shape=(n:Shape,paint:string,stroked:boolean,dx=0,dy=0)=>{
    const dash=stroked?dashPattern(n.borderStyle,n.shape==='line'?n.borderWidth||2:n.borderWidth):null
    const stroke={stroke:stroked?n.borderColor:'none',strokeWidth:stroked?n.borderWidth:0,strokeDasharray:dash?.join(' '),strokeLinecap:n.borderStyle==='dotted'?'round' as const:undefined}
    if(n.shape==='line')return <line x1={n.x+dx} y1={n.y+dy} x2={n.x+n.width+dx} y2={n.y+n.height+dy} stroke={stroked?n.color:paint} strokeWidth={n.borderWidth||2} strokeDasharray={dash?.join(' ')} strokeLinecap={stroke.strokeLinecap}/>
    if(n.shape==='ellipse')return <ellipse cx={n.x+n.width/2+dx} cy={n.y+n.height/2+dy} rx={n.width/2} ry={n.height/2} fill={paint} {...stroke}/>
    if(n.shape==='star'||n.shape==='badge')return <polygon points={shapePoints(n.shape,{...n,x:n.x+dx,y:n.y+dy}).map(p=>p.join(',')).join(' ')} fill={paint} {...stroke}/>
    return <rect x={n.x+dx} y={n.y+dy} width={n.width} height={n.height} rx={n.radius} fill={paint} {...stroke}/>
  }
  const text=(node:Text)=>{
    const s=node.style,spacing=s.letterSpacing??0,family=COUPON_FONTS[s.font]?.css??'CouponNoto, sans-serif'
    // Con espaciado se ancla a la izquierda con el ancho medido: mismo punto de partida que el PDF.
    const left=(line:Text['lines'][number])=>line.x-(s.align==='center'?line.width/2:s.align==='right'?line.width:0)
    const anchor=spacing?'start':s.align==='center'?'middle':s.align==='right'?'end':'start'
    const draw=(dx:number,dy:number,color:string,outline:boolean)=><text fill={color} fontFamily={family} fontWeight={s.bold?700:400} fontStyle={s.italic?'italic':undefined} fontSize={s.fontSize} letterSpacing={spacing||undefined} textAnchor={anchor}
      {...(outline&&s.strokeColor&&s.strokeWidth?{stroke:s.strokeColor,strokeWidth:s.strokeWidth}:{})}>{node.lines.map((line,i)=><tspan key={i} x={(spacing?left(line):line.x)+dx} y={line.baseline+dy}>{line.text}</tspan>)}</text>
    const decorations=(['underline','strike']as const).filter(kind=>s[kind]).flatMap(kind=>node.lines.map((line,i)=>{
      const y=line.baseline+(kind==='underline'?s.fontSize*.12:-s.fontSize*.3),x=left(line)
      return <line key={kind+i} data-decoration={kind} x1={x} y1={y} x2={x+line.width-spacing*[...line.text].length} y2={y} stroke={s.color} strokeWidth={Math.max(1,s.fontSize*.06)}/>
    }))
    return <>{s.background||s.borderColor?<rect x={node.x} y={node.y} width={node.width} height={node.height} rx={s.radius} fill={s.background||'none'} stroke={s.borderColor||'none'} strokeWidth={s.borderWidth}/>:null}
      {shadowOf(s.shadow,(dx,dy,color)=>draw(dx,dy,color,false))}{draw(0,0,s.color,true)}{decorations}</>
  }
  const draw=(node:SceneNode)=>{
    if(node.kind==='background'){
      if(node.fill.kind==='image')return image(node,assets.get(node.fill.assetId)?.url,node.fill.fit,node.fill.focalX,node.fill.focalY)
      return <rect x="0" y="0" width="1000" height={scene.height} fill={node.fill.kind==='gradient'?`url(#${gradient})`:node.fill.color}/>
    }
    if(node.kind==='image')return <>{shadowOf(node.shadow,(dx,dy,color)=><rect x={node.x+dx} y={node.y+dy} width={node.width} height={node.height} rx={node.radius} fill={color}/>)}{image(node,'assetId'in node.source?assets.get(node.source.assetId)?.url:logoUrl,node.fit,node.focalX,node.focalY)}</>
    if(node.kind==='shape')return <>{shadowOf(node.shadow,(dx,dy,color)=>shape(node,color,false,dx,dy))}{shape(node,node.gradient?`url(#${fill(node.id)})`:node.color,true)}</>
    return text(node)
  }
  const bg=scene.nodes[0]
  return <svg viewBox={`0 0 1000 ${scene.height}`} width="100%" role={previewOnly?'img':'group'} aria-label={previewOnly?'Vista previa del cupón':'Lienzo del cupón. Selecciona una capa y usa las flechas para moverla.'} tabIndex={previewOnly?undefined:0} style={{width:`${zoom*100}%`,maxWidth:'none',display:'block',touchAction:previewOnly?'auto':'none',userSelect:'none'}} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown}>
    <defs>{bg.kind==='background'&&bg.fill.kind==='gradient'&&(bg.fill.angle===undefined
      ?<linearGradient id={gradient} x1="0" y1="0" x2="1" y2=".59"><stop offset="0" stopColor={bg.fill.from}/><stop offset=".5" stopColor={bg.fill.from}/><stop offset="1" stopColor={bg.fill.to}/></linearGradient>
      :<linearGradient id={gradient} gradientUnits="userSpaceOnUse" {...gradientLine(bg.fill.angle,{x:0,y:0,width:1000,height:scene.height})}>{gradientStops(bg.fill).map(stop=><stop key={stop.offset} offset={stop.offset} stopColor={stop.color}/>)}</linearGradient>)}
      {scene.nodes.map(n=>n.kind==='shape'&&n.gradient?<linearGradient key={'g'+n.id} id={fill(n.id)} gradientUnits="userSpaceOnUse" {...gradientLine(n.gradient.angle,n)}>{gradientStops(n.gradient).map(stop=><stop key={stop.offset} offset={stop.offset} stopColor={stop.color}/>)}</linearGradient>:null)}
      {scene.nodes.map(n=><clipPath key={n.id} id={`${uid}-${n.id}`}><rect x={n.x} y={n.y} width={n.width} height={n.height} rx={n.kind==='image'?n.radius:undefined}/></clipPath>)}
    </defs>
    {scene.nodes.map(n=><g key={n.id} opacity={n.opacity} data-layer={n.id} transform={n.rotation?`rotate(${n.rotation} ${n.x+n.width/2} ${n.y+n.height/2})`:undefined} onPointerDown={previewOnly||n.kind==='background'?undefined:e=>{onSelect?.(n.id);onBeginMove?.(n.id,e)}}>{draw(n)}{!previewOnly&&n.id===selectedId&&<><rect x={n.x} y={n.y} width={n.width} height={n.height} fill="none" stroke="#ff6f00" strokeWidth="3" strokeDasharray="6 4" pointerEvents="none"/><rect aria-label="Redimensionar capa" x={n.x+n.width-10} y={n.y+n.height-10} width="20" height="20" fill="#ff6f00" onPointerDown={e=>{e.stopPropagation();onBeginResize?.(n.id,e)}}/></>}</g>)}
    {!previewOnly&&<rect x="25" y="18" width="950" height="684" fill="none" stroke="#94a3b8" strokeDasharray="5 5" opacity=".5" pointerEvents="none"/>}
    {!previewOnly&&guides.map((guide,i)=><line key={i} x1={guide.axis==='x'?guide.position:0} y1={guide.axis==='y'?guide.position:0} x2={guide.axis==='x'?guide.position:1000} y2={guide.axis==='y'?guide.position:scene.height} stroke="#ff6f00" strokeWidth="2" strokeDasharray="4 4" pointerEvents="none"/>)}
  </svg>
}

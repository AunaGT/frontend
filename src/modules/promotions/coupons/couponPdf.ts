import {jsPDF} from 'jspdf'
import {parseCouponDesign,couponAssetIds,type CouponDesign} from './couponDesign'
import {couponData,prepareCouponScene,withoutCouponCode,getCouponPrintLayout,couponImagePlacement,dashPattern,gradientLine,gradientStops,shapePoints,type CouponPromotion,type CouponCode,type CouponBranding,type SceneNode} from './couponPresentation'
import {couponFontIds,installCouponFonts,createCouponMeasure,setCouponFont} from './couponFonts'
import type {CouponAssets} from './CouponCanvas'
export interface CouponPdfOptions{design:CouponDesign;promotion:CouponPromotion;codes:CouponCode[];branding:CouponBranding;assets:CouponAssets;signal?:AbortSignal;printCode?:boolean}
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number]
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted)throw Error('Exportación cancelada por cambio de contexto')}
async function preserveWebpAlpha(bytes:Uint8Array):Promise<Uint8Array>{
  if(String.fromCharCode(...bytes.subarray(0,4))!=='RIFF'||String.fromCharCode(...bytes.subarray(8,12))!=='WEBP')return bytes
  if(typeof createImageBitmap!=='function')throw Error('Tu navegador no permite preparar esta imagen del cupón. Usa un navegador actualizado.')
  const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/webp'}))
  const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(bitmap.width,bitmap.height):document.createElement('canvas')
  canvas.width=bitmap.width;canvas.height=bitmap.height
  try{
    const ctx=canvas.getContext('2d') as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null
    if(!ctx)throw Error('No se pudo preparar la imagen del cupón')
    ctx.drawImage(bitmap,0,0)
    const png='convertToBlob'in canvas?await canvas.convertToBlob({type:'image/png'}):await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo preparar la imagen del cupón')),'image/png'))
    return new Uint8Array(await png.arrayBuffer())
  }finally{bitmap.close();canvas.width=0;canvas.height=0}
}
export async function buildCouponPdf({design:raw,promotion,codes,branding,assets,signal,printCode=true}:CouponPdfOptions):Promise<Blob>{
  const parsed=parseCouponDesign(raw)!,design=printCode?parsed:withoutCouponCode(parsed)
  if(!codes.length)throw Error('Selecciona al menos un código')
  const fonts=couponFontIds(design),measure=await createCouponMeasure(fonts);aborted(signal)
  const scenes=codes.map(code=>{
    const data=couponData({...promotion,coupon_design:design},code,branding)
    return prepareCouponScene(design,printCode?data:{...data,requiredFields:data.requiredFields.filter(field=>field!=='code')},measure)
  })
  const issues=scenes.flatMap(s=>s.issues).filter(i=>i.severity==='error')
  if(issues.length)throw Error(issues[0].message)
  const images=new Map<string,Uint8Array|string>()
  for(const id of couponAssetIds(design)){
    const asset=assets.get(id)
    if(!asset||!asset.url||!Number.isFinite(Date.parse(asset.expiresAt))||Date.parse(asset.expiresAt)<=Date.now())throw Error('La imagen del cupón no está disponible. Vuelve a cargar la vista previa.')
    try{const res=await fetch(asset.url,{signal});if(!res.ok)throw Error();images.set(id,await preserveWebpAlpha(new Uint8Array(await res.arrayBuffer())))}catch{aborted(signal);throw Error('No se pudo cargar la imagen del cupón '+id)}
  }
  if(branding.logoDataUrl)images.set('companyLogo',branding.logoDataUrl)
  aborted(signal)
  const p=getCouponPrintLayout(design.printPreset,design.aspect),doc=new jsPDF({format:'a4',orientation:p.orientation,compress:true}),scale=p.tileWidth/1000
  installCouponFonts(doc,fonts)
  const dimensions=new Map<string,{width:number;height:number;fileType:string}>()
  for(const[id,image]of images){try{dimensions.set(id,doc.getImageProperties(image))}catch{throw Error('La imagen del cupón no se pudo leer: '+id)}}
  type Box={x:number;y:number;width:number;height:number}
  const image=(key:string,box:Box,fit:'contain'|'cover',fx:number,fy:number,radius=0)=>{
    const source=images.get(key),info=dimensions.get(key);if(!source||!info)throw Error('Imagen del cupón no disponible: '+key)
    const placed=couponImagePlacement(box,info,fit,fx,fy)
    doc.saveGraphicsState()
    if(radius)doc.roundedRect(box.x,box.y,box.width,box.height,radius*scale,radius*scale,null);else doc.rect(box.x,box.y,box.width,box.height,null)
    doc.clip();doc.discardPath()
    doc.addImage(source,info.fileType,placed.x,placed.y,placed.width,placed.height,key,'FAST')
    doc.restoreGraphicsState()
  }
  // Un patrón de sombreado por degradado: coordenadas en mm de la propia caja, desplazado a su posición al rellenar.
  const patterns=new Set<string>()
  const shading=(key:string,g:{from:string;to:string;via?:string;angle?:number},size:{width:number;height:number})=>{
    if(patterns.has(key))return
    patterns.add(key)
    const line=gradientLine(g.angle??0,{x:0,y:0,...size})
    doc.advancedAPI(()=>doc.addShadingPattern(key,doc.ShadingPattern('axial',[line.x1,line.y1,line.x2,line.y2],gradientStops(g).map(stop=>({offset:stop.offset,color:rgb(stop.color)})))))
  }
  const gradient=design.background.kind==='gradient'?design.background:null
  if(gradient&&gradient.angle===undefined)doc.advancedAPI(()=>doc.addShadingPattern('coupon-gradient',doc.ShadingPattern('axial',[0,0,1,.59],[{offset:0,color:rgb(gradient.from)},{offset:.5,color:rgb(gradient.from)},{offset:1,color:rgb(gradient.to)}])))
  // Trayectoria de la forma; style null deja el camino listo para rellenar con patrón o recortar.
  const outline=(node:Extract<SceneNode,{kind:'shape'}>,box:Box,style:string|null)=>{
    if(node.shape==='ellipse')doc.ellipse(box.x+box.width/2,box.y+box.height/2,box.width/2,box.height/2,style)
    else if(node.shape==='star'||node.shape==='badge'){
      const points=shapePoints(node.shape,box)
      doc.lines(points.slice(1).map((point,i)=>[point[0]-points[i][0],point[1]-points[i][1]]),points[0][0],points[0][1],[1,1],style,true)
    }else doc.roundedRect(box.x,box.y,box.width,box.height,node.radius*scale,node.radius*scale,style)
  }
  const dashed=(style:'solid'|'dashed'|'dotted'|undefined,width:number)=>{
    const dash=dashPattern(style,width);doc.setLineDashPattern(dash?dash.map(v=>v*scale):[],0);doc.setLineCap(style==='dotted'?'round':'butt')
  }
  const draw=(node:SceneNode,left:number,top:number)=>{
    const box={x:left+node.x*scale,y:top+node.y*scale,width:node.width*scale,height:node.height*scale}
    const opacity=(value:number)=>doc.setGState(doc.GState({opacity:value,'stroke-opacity':value}))
    // Sombra: copia desplazada sin difuminado (un PDF vectorial no difumina), igual que en la vista previa.
    const withShadow=(shadow:{x:number;y:number;color:string;opacity:number}|null|undefined,paint:(shifted:Box,color:[number,number,number])=>void)=>{
      if(!shadow)return
      doc.saveGraphicsState();opacity(node.opacity*shadow.opacity)
      paint({...box,x:box.x+shadow.x*scale,y:box.y+shadow.y*scale},rgb(shadow.color))
      doc.restoreGraphicsState()
    }
    const paint=()=>{
      if(node.kind==='background'){
        if(node.fill.kind==='image')image(node.fill.assetId,box,node.fill.fit,node.fill.focalX,node.fill.focalY)
        else if(node.fill.kind==='gradient'&&node.fill.angle===undefined)doc.advancedAPI(()=>{doc.rect(box.x,box.y,box.width,box.height,null);doc.fill({key:'coupon-gradient',matrix:doc.Matrix(box.width,0,0,box.height,box.x,box.y)})})
        else if(node.fill.kind==='gradient'){const fill=node.fill;shading('coupon-bg',fill,box);doc.advancedAPI(()=>{doc.rect(box.x,box.y,box.width,box.height,null);doc.fill({key:'coupon-bg',matrix:doc.Matrix(1,0,0,1,box.x,box.y)})})}
        else{doc.setFillColor(...rgb(node.fill.color));doc.rect(box.x,box.y,box.width,box.height,'F')}
      }else if(node.kind==='image'){
        withShadow(node.shadow,(shifted,color)=>{doc.setFillColor(...color);doc.roundedRect(shifted.x,shifted.y,shifted.width,shifted.height,(node.radius??0)*scale,(node.radius??0)*scale,'F')})
        image('assetId'in node.source?node.source.assetId:'companyLogo',box,node.fit,node.focalX,node.focalY,node.radius)
      }else if(node.kind==='shape'){
        if(node.shape==='line'){
          const line=(b:Box,color:[number,number,number])=>{doc.setDrawColor(...color);doc.setLineWidth((node.borderWidth||2)*scale);dashed(node.borderStyle,node.borderWidth||2);doc.line(b.x,b.y,b.x+b.width,b.y+b.height)}
          withShadow(node.shadow,line);line(box,rgb(node.color));dashed(undefined,0)
        }else{
          withShadow(node.shadow,(shifted,color)=>{doc.setFillColor(...color);outline(node,shifted,'F')})
          if(node.gradient){const key='coupon-g-'+node.id;shading(key,node.gradient,box);doc.advancedAPI(()=>{outline(node,box,null);doc.fill({key,matrix:doc.Matrix(1,0,0,1,box.x,box.y)})})}
          else{doc.setFillColor(...rgb(node.color));outline(node,box,'F')}
          if(node.borderWidth){doc.setDrawColor(...rgb(node.borderColor));doc.setLineWidth(node.borderWidth*scale);dashed(node.borderStyle,node.borderWidth);outline(node,box,'S');dashed(undefined,0)}
        }
      }else{
        const s=node.style,spacing=(s.letterSpacing??0)
        if(s.background||s.borderColor){if(s.background)doc.setFillColor(...rgb(s.background));if(s.borderColor)doc.setDrawColor(...rgb(s.borderColor));doc.setLineWidth(s.borderWidth*scale);doc.roundedRect(box.x,box.y,box.width,box.height,s.radius*scale,s.radius*scale,s.background&&s.borderColor?'FD':s.background?'F':'S')}
        setCouponFont(doc,s,s.fontSize*scale*72/25.4)
        // Con espaciado se ancla a la izquierda con el ancho medido; sin espaciado se conserva la alineación de la fase 1.
        const startOf=(line:typeof node.lines[number])=>line.x-(s.align==='center'?line.width/2:s.align==='right'?line.width:0)
        const write=(dx:number,dy:number,outlined:boolean)=>{for(const line of node.lines){
          const options={...(spacing?{charSpace:spacing*scale}:{align:s.align}),...(outlined?{renderingMode:'fillThenStroke' as const}:{})}
          doc.text(line.text,left+((spacing?startOf(line):line.x)+dx)*scale,top+(line.baseline+dy)*scale,options)
        }}
        if(s.shadow){const shadow=s.shadow;doc.saveGraphicsState();opacity(node.opacity*shadow.opacity);doc.setTextColor(...rgb(shadow.color));write(shadow.x,shadow.y,false);doc.restoreGraphicsState()}
        doc.setTextColor(...rgb(s.color))
        const outlined=!!s.strokeColor&&!!s.strokeWidth
        if(outlined){doc.setDrawColor(...rgb(s.strokeColor!));doc.setLineWidth(s.strokeWidth!*scale)}
        write(0,0,outlined)
        for(const kind of ['underline','strike'] as const)if(s[kind]){
          doc.setDrawColor(...rgb(s.color));doc.setLineWidth(Math.max(1,s.fontSize*.06)*scale)
          for(const line of node.lines){const y=top+(line.baseline+(kind==='underline'?s.fontSize*.12:-s.fontSize*.3))*scale,x=left+startOf(line)*scale;doc.line(x,y,x+(line.width-spacing*[...line.text].length)*scale,y)}
        }
      }
    }
    doc.saveGraphicsState();opacity(node.opacity)
    // Capa rotada: se dibuja completa dentro de la API avanzada con la matriz de giro alrededor de su centro.
    if(node.rotation){
      const cx=box.x+box.width/2,cy=box.y+box.height/2,a=node.rotation*Math.PI/180,c=Math.cos(a),sin=Math.sin(a)
      doc.advancedAPI(d=>{d.saveGraphicsState();d.setCurrentTransformationMatrix(d.Matrix(c,sin,-sin,c,cx-c*cx+sin*cy,cy-sin*cx-c*cy));paint();d.restoreGraphicsState()})
    }else paint()
    doc.restoreGraphicsState()
  }
  const perPage=p.columns*p.rows,startX=(p.pageWidth-(p.columns*p.tileWidth+(p.columns-1)*p.gap))/2
  scenes.forEach((scene,index)=>{
    if(index&&index%perPage===0)doc.addPage()
    const slot=index%perPage,x=startX+(slot%p.columns)*(p.tileWidth+p.gap),y=p.top+Math.floor(slot/p.columns)*(p.tileHeight+p.gap)
    doc.saveGraphicsState();doc.rect(x,y,p.tileWidth,p.tileHeight,null);doc.clip();doc.discardPath()
    for(const node of scene.nodes)draw(node,x,y)
    doc.restoreGraphicsState()
    doc.setDrawColor(150,160,175);doc.setLineWidth(.2);doc.setLineDashPattern([1,1],0);doc.rect(x,y,p.tileWidth,p.tileHeight);doc.setLineDashPattern([],0)
  })
  const pages=doc.getNumberOfPages()
  for(let page=1;page<=pages;page++){
    doc.setPage(page);doc.setFont('CouponNoto','normal');doc.setFontSize(8);doc.setTextColor(99,117,139);doc.text('Página '+page+' de '+pages,p.pageWidth-10,p.pageHeight-6,{align:'right'})
  }
  aborted(signal);return doc.output('blob')
}

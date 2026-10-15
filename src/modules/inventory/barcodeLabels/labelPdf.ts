import {jsPDF} from 'jspdf'
import {buildLabelPrintPlan} from './labelLayout'
import {PT_MM} from './labelScene'
import type {LabelScene} from './labelScene'
import {textStyle} from './labelDesign'
import {createCouponMeasure,ensureCouponFonts,installCouponFonts,setCouponFont} from '@/modules/promotions/coupons/couponFonts'
import type {CouponFontId} from '@/modules/promotions/coupons/couponDesign'
import type {PreparedLabels} from './types'
export type BarcodePdfResult=Awaited<ReturnType<typeof generateBarcodeLabelPdf>>
const rgb=(hex:string)=>[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)) as [number,number,number]
export function drawLabelScene(doc:jsPDF,scene:LabelScene,left:number,top:number){
  doc.setFillColor(255,255,255);doc.rect(left,top,scene.widthMm,scene.heightMm,'F')
  for(const n of scene.nodes){
    const x=left+n.x,y=top+n.y
    if(n.kind==='barcode'){doc.setFillColor(255,255,255);doc.rect(x,y,n.width,n.height,'F');doc.setFillColor(0,0,0);for(const bar of n.bars)doc.rect(x+bar.x,y+bar.y,bar.width,bar.height,'F')}
    else if(n.kind==='shape'){doc.setFillColor(...rgb(n.color));doc.setDrawColor(...rgb(n.borderColor));doc.setLineWidth(n.shape==='line'?Math.max(.1,n.borderWidth*PT_MM):n.borderWidth*PT_MM);if(n.shape==='ellipse')doc.ellipse(x+n.width/2,y+n.height/2,n.width/2,n.height/2,n.borderWidth?'FD':'F');else if(n.shape==='line')doc.line(x,y,x+n.width,y+n.height);else doc.rect(x,y,n.width,n.height,n.borderWidth?'FD':'F')}
    else{
      const s=n.style,pad=s.padding*PT_MM
      if(s.background){doc.setFillColor(...rgb(s.background));doc.roundedRect(x,y,n.width,n.height,s.radius*PT_MM,s.radius*PT_MM,'F')}
      if(s.borderColor&&s.borderWidth){doc.setDrawColor(...rgb(s.borderColor));doc.setLineWidth(s.borderWidth*PT_MM);doc.roundedRect(x,y,n.width,n.height,s.radius*PT_MM,s.radius*PT_MM,'S')}
      setCouponFont(doc,s);doc.setTextColor(...rgb(s.color));doc.setCharSpace((s.letterSpacing||0)*PT_MM)
      const tx=s.align==='center'?x+n.width/2:s.align==='right'?x+n.width-pad:x+pad
      n.lines.forEach((line,i)=>{const baseline=y+pad+s.fontSize*PT_MM*.82+i*s.fontSize*s.lineHeight*PT_MM;doc.text(line,tx,baseline,{align:s.align});if(s.underline||s.strike){const width=doc.getTextWidth(line),start=s.align==='center'?tx-width/2:s.align==='right'?tx-width:tx;doc.setDrawColor(...rgb(s.color));doc.setLineWidth(.15);if(s.underline)doc.line(start,baseline+.4,start+width,baseline+.4);if(s.strike)doc.line(start,baseline-s.fontSize*PT_MM*.3,start+width,baseline-s.fontSize*PT_MM*.3)}})
      doc.setCharSpace(0)
    }
  }
}
export async function generateBarcodeLabelPdf(prepared:PreparedLabels,{signal,onProgress}:{signal?:AbortSignal;onProgress?:(progress:{donePages:number;totalPages:number})=>void}={}){
  const ids=[...new Set<CouponFontId>(['NotoSans',...prepared.design.elements.flatMap(e=>e.kind==='field'||e.kind==='text'?[e.style.font]:[])])]
  await ensureCouponFonts(ids);const measure=await createCouponMeasure(ids),plan=buildLabelPrintPlan(prepared,measure)
  const make=(w:number,h:number)=>{const doc=new jsPDF({unit:'mm',format:[w,h],orientation:w>h?'landscape':'portrait',compress:true});installCouponFonts(doc,ids);doc.setProperties({title:prepared.design.purpose==='shelf'?'Etiquetas de precio para estante':'Etiquetas de códigos de barras',author:prepared.companyName});return doc}
  const labels=make(plan.grid.widthMm,plan.grid.heightMm),thermal=prepared.paper.format==='thermal',separate=thermal&&plan.guidePages.length?make(plan.guideWidth,plan.guideHeight):null
  const totalPages=plan.labelPages.length+plan.guidePages.length;let donePages=0
  const tick=async()=>{if(signal?.aborted)throw new DOMException('Impresión cancelada','AbortError');onProgress?.({donePages:++donePages,totalPages});await new Promise(resolve=>setTimeout(resolve,0));if(signal?.aborted)throw new DOMException('Impresión cancelada','AbortError')}
  const heading=(doc:jsPDF,title:string,x:number,y:number,size=9)=>{const style=textStyle(true,size);setCouponFont(doc,style);doc.setTextColor(20,33,50);doc.text(title,x,y)}
  for(let i=0;i<plan.guidePages.length;i++){
    const doc=separate||labels;if(i>0)doc.addPage([plan.guideWidth,plan.guideHeight],plan.guideWidth>plan.guideHeight?'landscape':'portrait')
    // Company title centered, independent of company name length.
    setCouponFont(doc,textStyle(true,11));const companyWidth=doc.getTextWidth(prepared.companyName);if(companyWidth>plan.guideWidth-20)throw Error('El nombre de la empresa no cabe en el encabezado de la guía')
    doc.text(prepared.companyName,plan.guideWidth/2,13,{align:'center'})
    heading(doc,'Guía de impresión',10,22);setCouponFont(doc,textStyle(false,8));doc.text(`${prepared.products.length} productos · ${prepared.products.reduce((n,p)=>n+p.copies,0)} etiquetas`,10,28)
    doc.text(`${prepared.paper.format} · ${prepared.design.widthMm} × ${prepared.design.heightMm} mm · ${new Date(prepared.createdAt).toLocaleDateString(prepared.locale,{timeZone:prepared.timezone})}`,10,33)
    let y=40
    for(const row of plan.guidePages[i]){
      setCouponFont(doc,textStyle(false,8));row.lines.forEach((line,j)=>doc.text(line,10,y+3+j*8*1.15*PT_MM))
      row.metadataLines.forEach((line,j)=>doc.text(line,row.stackMetadata?10:plan.guideWidth-10,y+3+(row.stackMetadata?row.lines.length+j:j)*8*1.15*PT_MM,{align:row.stackMetadata?'left':'right'}))
      doc.setDrawColor(210,215,224);doc.setLineWidth(.15);doc.line(10,y+row.height-1,plan.guideWidth-10,y+row.height-1);y+=row.height
    }
    setCouponFont(doc,textStyle(false,7));doc.text(`Guía ${i+1}/${plan.guidePages.length} · Imprimir al 100 %, sin ajustar`,10,plan.guideHeight-6)
    await tick()
  }
  for(let i=0;i<plan.labelPages.length;i++){
    const page=plan.labelPages[i];if(i>0||plan.inlineGuidePages)labels.addPage([plan.grid.widthMm,plan.grid.heightMm],plan.grid.widthMm>plan.grid.heightMm?'landscape':'portrait')
    if(!thermal){setCouponFont(labels,textStyle(true,9));labels.setTextColor(20,33,50);page.headingLines.forEach((line,j)=>labels.text(line,prepared.paper.margins.left,prepared.paper.margins.top+3+j*9*1.15*PT_MM));setCouponFont(labels,textStyle(false,7));labels.text(`${prepared.design.purpose==='shelf'?'Hoja':'Producto'} ${page.relativePage}/${page.productPages} · Documento ${page.absolutePage}/${plan.totalPages}`,plan.grid.widthMm-prepared.paper.margins.right,prepared.paper.margins.top+10,{align:'right'})}
    page.products.forEach((id,n)=>drawLabelScene(labels,plan.scenes.get(id)!,plan.grid.left+(n%plan.grid.columns)*(prepared.design.widthMm+prepared.paper.gapX),plan.grid.top+Math.floor(n/plan.grid.columns)*(prepared.design.heightMm+prepared.paper.gapY)))
    await tick()
  }
  return{labels:labels.output('blob'),guide:separate?separate.output('blob'):null,plan}
}

import {computeLabelGrid} from './labelContract'
import {textStyle} from './labelDesign'
import {prepareLabelScene,wrapLabelText,PT_MM} from './labelScene'
import type {CouponMeasure} from '@/modules/promotions/coupons/couponPresentation'
import type {PreparedLabels} from './types'
import {labelSelectionKey} from './types'
export {computeLabelGrid}
export function buildLabelPrintPlan(prepared:PreparedLabels,measure:CouponMeasure,separateGuide=false){
  const identity=(p:PreparedLabels['products'][number])=>prepared.snapshotVersion===2?labelSelectionKey(p):p.id
  const grid=computeLabelGrid(prepared.design,prepared.paper),thermal=prepared.paper.format==='thermal',guideWidth=thermal?215.9:grid.widthMm,guideHeight=thermal?279.4:grid.heightMm
  const guideStyle=textStyle(false,8),headStyle=textStyle(true,9),guideRows=(prepared.paper.includeGuide?prepared.products:[]).map(p=>{
    const width=guideWidth-20;if(width<60)throw Error('El formato es demasiado angosto para la guía. Desactiva la guía o amplía la hoja')
    const reservedMetadata=`${p.copies} copias · pág. 9999–9999`,metadataWidth=measure(reservedMetadata,guideStyle)*PT_MM
    const stackMetadata=width<120||metadataWidth+4>width*.38
    const lines=wrapLabelText([p.name,p.barcode].filter(Boolean).join('\n'),stackMetadata?width:width-metadataWidth-4,guideStyle,measure)
    const metadataLines=wrapLabelText(reservedMetadata,stackMetadata?width:metadataWidth,guideStyle,measure)
    return{productId:identity(p),copies:p.copies,lines,stackMetadata,metadataLines,height:Math.max(9,(lines.length+(stackMetadata?metadataLines.length:0))*guideStyle.fontSize*guideStyle.lineHeight*PT_MM+3)}
  })
  const guidePages:typeof guideRows[]=[]
  if(prepared.paper.includeGuide){let page:typeof guideRows=[],used=40;for(const row of guideRows){if(row.height>guideHeight-50)throw Error('El producto no cabe en la guía; amplía la hoja');if(used+row.height>guideHeight-10){guidePages.push(page);page=[];used=40}page.push(row);used+=row.height}if(page.length)guidePages.push(page)}
  const inlineGuidePages=thermal||separateGuide?0:guidePages.length,labelPages:{productId:string;products:string[];relativePage:number;productPages:number;absolutePage:number;headingLines:string[]}[]=[],ranges:{productId:string;firstPage:number;lastPage:number;copies:number}[]=[],scenes=new Map<string,ReturnType<typeof prepareLabelScene>>()
  let pageNumber=inlineGuidePages+1
  const shelf=prepared.design.purpose==='shelf';let emitted=0
  for(const p of prepared.products){
    scenes.set(identity(p),prepareLabelScene(p,prepared.design,measure,prepared))
    const headingWidth=grid.widthMm-prepared.paper.margins.left-prepared.paper.margins.right
    const heading=shelf?(headingWidth<60?'Precios de estante':'Etiquetas de precio para estante'):p.barcode?`${p.name} · ${p.barcode}`:p.name
    const headingLines=thermal?[]:wrapLabelText(heading,headingWidth,headStyle,measure)
    if(headingLines.length*headStyle.fontSize*headStyle.lineHeight*PT_MM>10)throw Error(`${p.name}: el encabezado no cabe. Amplía la hoja`)
    if(shelf){
      const firstPage=inlineGuidePages+Math.floor(emitted/grid.capacity)+1
      for(let i=0;i<p.copies;i++){const index=Math.floor(emitted/grid.capacity);if(!labelPages[index])labelPages.push({productId:'mixed',products:[],relativePage:index+1,productPages:0,absolutePage:inlineGuidePages+index+1,headingLines});labelPages[index].products.push(identity(p));emitted++}
      ranges.push({productId:identity(p),firstPage,lastPage:inlineGuidePages+Math.ceil(emitted/grid.capacity),copies:p.copies});continue
    }
    const count=Math.ceil(p.copies/grid.capacity),firstPage=pageNumber
    for(let n=0;n<count;n++)labelPages.push({productId:identity(p),products:Array(Math.min(grid.capacity,p.copies-n*grid.capacity)).fill(identity(p)),relativePage:n+1,productPages:count,absolutePage:pageNumber++,headingLines})
    ranges.push({productId:identity(p),firstPage,lastPage:pageNumber-1,copies:p.copies})
  }
  if(shelf)for(const page of labelPages)page.productPages=labelPages.length
  if(labelPages.length>500||prepared.products.reduce((n,p)=>n+p.copies,0)>5000)throw Error('Divide la impresión para reducir páginas y etiquetas')
  for(const row of guidePages.flat()){
    const range=ranges.find(r=>r.productId===row.productId)!,text=`${row.copies} copias · pág. ${range.firstPage}${range.lastPage!==range.firstPage?`–${range.lastPage}`:''}`
    row.metadataLines=wrapLabelText(text,guideWidth-20,guideStyle,measure)
  }
  return{grid,guideWidth,guideHeight,guidePages,inlineGuidePages,labelPages,ranges,scenes,totalPages:inlineGuidePages+labelPages.length}
}

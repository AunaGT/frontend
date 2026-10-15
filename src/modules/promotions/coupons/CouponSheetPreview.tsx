import {useMemo,useState} from 'react'
import {Button} from '@/components/ui/button'
import {ChevronLeft,ChevronRight} from 'lucide-react'
import {CouponCanvas,type CouponAssets} from './CouponCanvas'
import type {CouponDesign} from './couponDesign'
import {prepareCouponScene,getCouponPrintLayout,type CouponData,type CouponMeasure} from './couponPresentation'
import {useCouponMeasure} from './useCouponMeasure'
export function CouponSheetPreview({design,data,assets,logoUrl,measure:provided}:{design:CouponDesign;data:CouponData[];assets:CouponAssets;logoUrl?:string;measure?:CouponMeasure}){
  const own=useCouponMeasure(provided?null:design),measure=provided??own.measure,error=provided?'':own.error,[page,setPage]=useState(0)
  const p=getCouponPrintLayout(design.printPreset,design.aspect),perPage=p.columns*p.rows,total=Math.max(1,Math.ceil(data.length/perPage)),safePage=Math.min(page,total-1),start=(p.pageWidth-p.columns*p.tileWidth-(p.columns-1)*p.gap)/2
  const scenes=useMemo(()=>measure?data.slice(safePage*perPage,(safePage+1)*perPage).map(d=>prepareCouponScene(design,d,measure)):[],[data,design,measure,safePage,perPage])
  return <section aria-label="Vista previa de impresión" className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>A4 {p.orientation==='landscape'?'horizontal':'vertical'} · {p.tileWidth} × {p.tileHeight} mm por cupón</span>{total>1&&<div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="Hoja anterior" disabled={safePage===0} onClick={()=>setPage(safePage-1)}><ChevronLeft className="h-4 w-4"/></Button><span>{safePage+1}/{total}</span><Button type="button" variant="outline" size="icon" aria-label="Hoja siguiente" disabled={safePage>=total-1} onClick={()=>setPage(safePage+1)}><ChevronRight className="h-4 w-4"/></Button></div>}</div>
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:<div className="relative mx-auto w-full max-w-[760px] overflow-hidden bg-white shadow-sm" style={{aspectRatio:`${p.pageWidth}/${p.pageHeight}`}}>
      {scenes.map((scene,i)=><div key={scene.nodes.find(n=>n.id==='field-code')?.id+'-'+i} className="absolute" style={{left:`${(start+(i%p.columns)*(p.tileWidth+p.gap))/p.pageWidth*100}%`,top:`${(p.top+Math.floor(i/p.columns)*(p.tileHeight+p.gap))/p.pageHeight*100}%`,width:`${p.tileWidth/p.pageWidth*100}%`,height:`${p.tileHeight/p.pageHeight*100}%`,outline:'1px dashed #94a3b8'}}><CouponCanvas scene={scene} assets={assets} logoUrl={logoUrl} previewOnly/></div>)}
      <span className="absolute bottom-[2%] right-[3.5%] text-[9px] text-slate-500">Página {safePage+1} de {total}</span>
    </div>}
  </section>
}

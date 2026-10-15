import {useMemo} from 'react'
import {CouponCanvas,type CouponAssets} from './CouponCanvas'
import {createDefaultCouponDesign,type CouponDesign} from './couponDesign'
import {couponData,prepareCouponScene,type CouponPromotion,type CouponCode,type CouponBranding} from './couponPresentation'
import {useCouponMeasure} from './useCouponMeasure'
import './couponEditor.css'
export function CouponPreview({design,promotion,code,branding,assets=new Map()}:{design?:CouponDesign|null;promotion:CouponPromotion;code:CouponCode;branding:CouponBranding;assets?:CouponAssets}){
  const {measure,error}=useCouponMeasure(design||createDefaultCouponDesign())
  const scene=useMemo(()=>measure?prepareCouponScene(design||createDefaultCouponDesign(),couponData(promotion,code,branding),measure):null,[design,promotion,code,branding,measure])
  return <div className="overflow-hidden rounded-xl border bg-white">{scene?<CouponCanvas scene={scene} assets={assets} logoUrl={branding.logoDataUrl} previewOnly/>:<p className="p-6 text-sm text-muted-foreground" role={error?'alert':undefined}>{error||'Preparando vista previa…'}</p>}</div>
}

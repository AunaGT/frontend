import type {ReactNode} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {usePageTrail} from '@/components/layout/PageNavigation'
import type {PageTrailItem} from '@/components/layout/pageTrail'
import {CouponEditor} from '../coupons/CouponEditor'
import {couponData} from '../coupons/couponPresentation'
import {useCouponModel,type CouponModelProps} from './useCouponModel'

// Vista propia del diseño del cupón dentro de crear/editar: trabaja sobre el mismo borrador del formulario.
export function PromotionCouponDesigner({formPath,trail,banner,...props}:CouponModelProps&{formPath:string;trail:PageTrailItem[];banner?:ReactNode}){
  const navigate=useNavigate(),location=useLocation()
  usePageTrail(trail)
  const {promotion,code,branding,logoUrl}=useCouponModel(props)
  const back=()=>(location.state as {fromForm?:boolean}|null)?.fromForm?navigate(-1):navigate(formPath,{replace:true})
  const {coupon}=props
  return <CouponEditor key={coupon.draftId} value={coupon.design} onChange={coupon.setDesign} data={couponData(promotion,code,branding)} assets={coupon.assets} logoUrl={logoUrl} onUpload={coupon.upload} onBack={back}
    banner={<>{banner}{coupon.error&&<p role="alert" className="text-sm text-destructive">{coupon.error}</p>}</>}/>
}

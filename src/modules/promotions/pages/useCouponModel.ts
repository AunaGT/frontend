import {useSystemSettings} from '@/hooks/useSystemSettings'
import {useTenant} from '@/context/useTenant'
import type {CouponCode,CouponPromotion} from '../coupons/couponPresentation'
import type {useCouponDesign} from '../coupons/useCouponDesign'
import type {ApplicableProductRef} from './PromotionApplicableScopeFields'

export type CouponModelProps={
  coupon:ReturnType<typeof useCouponDesign>
  formData:{buy_quantity:string;get_quantity:string;min_quantity:string;max_uses_per_customer:string;min_purchase_amount:string}
  code?:CouponCode
  name:string
  description:string
  typeName?:string
  percentage?:string
  amount?:string
  startDate:string
  endDate:string
  products:ApplicableProductRef[]
  appliesToAllBranches:boolean
  branchIds:string[]
  maxUses:string
  active?:boolean
}

// La vista previa del formulario y el diseñador arman el cupón con los mismos datos del formulario.
export function useCouponModel({coupon,formData,code={code:'CÓDIGO-EJEMPLO'},name,description,typeName,percentage,amount,startDate,endDate,appliesToAllBranches,branchIds,maxUses,active=true}:CouponModelProps){
  const {companyName,companyLogoUrl,locale,currencyCode,timezone}=useSystemSettings()
  const {branches}=useTenant()
  const selectedBranches=branches.filter(branch=>branchIds.includes(branch.id))
  const promotion:CouponPromotion={name,description,type:{name:typeName||''},discount_percentage:percentage,discount_value:amount,buy_quantity:Number(formData.buy_quantity)||null,get_quantity:Number(formData.get_quantity)||null,min_quantity:Number(formData.min_quantity)||null,start_date:startDate,end_date:endDate,max_uses:Number(maxUses)||null,max_uses_per_customer:Number(formData.max_uses_per_customer)||null,min_purchase_amount:formData.min_purchase_amount,active,applies_to_all_branches:appliesToAllBranches,branches:selectedBranches.map(branch=>({branch})),coupon_design:coupon.design}
  return{promotion,code,branding:{companyName,logoDataUrl:companyLogoUrl,locale,currencyCode,timezone},logoUrl:companyLogoUrl}
}

import {getAgenda,mutateAgenda} from './api'
import type {AgendaScope} from './types'
import type {EngagementCreate,EngagementDetail,EngagementProgramInput,EngagementPaymentInput,EngagementPaymentResult,EngagementSaleInput,EngagementResolutionInput} from './commercialTypes'
import type {BillingOrigin,BillingChoices,BillingPrepareInput,BillingPreview} from './commercialTypes'
export const previewSourceBilling=(scope:AgendaScope,origin:BillingOrigin,input:BillingChoices,signal?:AbortSignal)=>mutateAgenda<BillingPreview>(`/billing-sources/${origin.kind==='BOOKING'?'bookings':'activities'}/${encodeURIComponent(origin.id)}/preview`,scope,input,signal)
export const prepareSourceBilling=(scope:AgendaScope,origin:BillingOrigin,input:BillingPrepareInput,signal?:AbortSignal)=>mutateAgenda<EngagementDetail>(`/billing-sources/${origin.kind==='BOOKING'?'bookings':'activities'}/${encodeURIComponent(origin.id)}/prepare`,scope,input,signal)
export const getCommercialEngagement=(scope:AgendaScope,id:string,signal?:AbortSignal)=>getAgenda<EngagementDetail>(`/engagements/${encodeURIComponent(id)}`,scope,signal)
export const createCommercialEngagement=(scope:AgendaScope,input:EngagementCreate,signal?:AbortSignal)=>mutateAgenda<EngagementDetail>('/engagements',scope,input,signal)
export const programCommercialEngagement=(scope:AgendaScope,id:string,input:EngagementProgramInput,signal?:AbortSignal)=>mutateAgenda<EngagementDetail>(`/engagements/${encodeURIComponent(id)}/program`,scope,input,signal)
export const collectCommercialEngagementPayment=(scope:AgendaScope,id:string,input:EngagementPaymentInput,signal?:AbortSignal)=>mutateAgenda<EngagementPaymentResult>(`/engagements/${encodeURIComponent(id)}/payments`,scope,input,signal)
export const issueCommercialEngagementSale=(scope:AgendaScope,id:string,input:EngagementSaleInput,signal?:AbortSignal)=>mutateAgenda<EngagementDetail>(`/engagements/${encodeURIComponent(id)}/sale`,scope,input,signal)
export const resolveCommercialEngagementFunds=(scope:AgendaScope,id:string,input:EngagementResolutionInput,signal?:AbortSignal)=>mutateAgenda<EngagementDetail>(`/engagements/${encodeURIComponent(id)}/resolution`,scope,input,signal)

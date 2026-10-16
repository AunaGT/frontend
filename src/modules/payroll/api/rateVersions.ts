import {apiFetch} from '@/services/api'
import type {SettingsScope} from '@/services/settingsService'
export type PayrollRates=Record<string,number>
export type ResolvedRates={rates:PayrollRates;versionId:string|null;source:'legacy'|'baseline'|'version'}
export type RatesSnapshot=ResolvedRates&{capturedAt:string}
export type RateVersion={id:string;effective_from:string|null;is_baseline:boolean;rates:PayrollRates;reason:string;created_by:string|null;created_at:string;cancelled_at:string|null;cancel_reason:string|null}
export type RateVersionsResult={items:RateVersion[];current:ResolvedRates;today:string}
const options=(scope:SettingsScope):RequestInit=>({headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}})
export const getRateVersions=(scope:SettingsScope)=>apiFetch<RateVersionsResult>('/api/payroll/rate-versions',options(scope))
export const publishRateVersion=(payload:{effectiveFrom:string;rates:PayrollRates;reason:string},scope:SettingsScope)=>apiFetch<RateVersion>('/api/payroll/rate-versions',{...options(scope),method:'POST',body:JSON.stringify(payload)})
export const cancelRateVersion=(id:string,reason:string,scope:SettingsScope)=>apiFetch<RateVersion>(`/api/payroll/rate-versions/${id}/cancel`,{...options(scope),method:'POST',body:JSON.stringify({reason})})
export const previewRunRates=(id:string,scope:SettingsScope)=>apiFetch<ResolvedRates>(`/api/payroll/runs/${id}/rates-preview`,options(scope))
export const adoptRunRates=(id:string,expected:ResolvedRates,scope:SettingsScope)=>apiFetch(`/api/payroll/runs/${id}/adopt-rates`,{...options(scope),method:'POST',body:JSON.stringify({confirmed:true,expectedVersionId:expected.versionId,expectedRates:expected.rates})})

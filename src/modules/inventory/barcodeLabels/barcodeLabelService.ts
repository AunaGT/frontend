import {apiFetch} from '@/services/api'
import type {BarcodeLabelLayout,LabelCandidate,PreparedLabels,PrepareLabelsInput,LabelPurpose} from './types'
const base=(purpose:LabelPurpose)=>purpose==='shelf'?'/products/shelf-labels':'/products/barcode-labels'
export const fetchBarcodeLayout=(signal?:AbortSignal,purpose:LabelPurpose='barcode'):Promise<BarcodeLabelLayout>=>apiFetch(base(purpose)+'/layout',{signal})
export const saveBarcodeLayout=(input:{expectedRevision:number;design:BarcodeLabelLayout['design'];defaultPaper:BarcodeLabelLayout['defaultPaper']},signal?:AbortSignal,branchId?:string,purpose:LabelPurpose='barcode'):Promise<BarcodeLabelLayout>=>apiFetch(base(purpose)+'/layout',{method:'PUT',headers:branchId?{'X-Branch-Id':branchId}:undefined,body:JSON.stringify(input),signal})
export const fetchBarcodeCandidates=(query:Record<string,string|number|boolean|undefined>,signal?:AbortSignal,purpose:LabelPurpose='barcode'):Promise<{items:LabelCandidate[];totalItems:number;totalPages:number;page:number}>=>{
  const search=new URLSearchParams();for(const [key,value]of Object.entries(query))if(value!==undefined&&value!=='')search.set(key,String(value))
  return apiFetch(base(purpose)+'/candidates?'+search.toString(),{signal})
}
export const prepareBarcodeLabels=(input:PrepareLabelsInput,signal?:AbortSignal,purpose:LabelPurpose='barcode'):Promise<PreparedLabels>=>apiFetch(base(purpose)+'/prepare',{method:'POST',headers:{'X-Branch-Id':input.scope.branchId},body:JSON.stringify(input),signal})

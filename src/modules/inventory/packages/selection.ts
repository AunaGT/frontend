import {useEffect,useRef,useState} from 'react'
import {normalizeUnitDecimal,unitTicks,unitFromTicks} from '@/lib/unitQuantity'
import {previewPackages} from '@/modules/inventory/packages/api'
import type {PackageChoice,PackageSelection,PackageGroup,PackageScope} from '@/modules/inventory/packages/types'
export function packageSelectionsPayload(value:PackageSelection[]):PackageSelection[]{
 return value.map(s=>({groupId:s.groupId,packageId:s.packageId,version:s.version,variantId:s.variantId,choices:s.choices.map(c=>({choiceId:c.choiceId,items:c.items.filter(i=>i.quantity.trim()&&i.quantity!=='0').map(i=>({optionId:i.optionId,quantity:normalizeUnitDecimal(i.quantity,{allowZero:false})}))}))}))
}
export function packageProgress(choice:PackageChoice,selection?:PackageSelection['choices'][number]){
 try{
  const total=unitTicks(choice.totalQuantity??'0'),selected=(selection?.items??[]).reduce((sum,i)=>sum+unitTicks(i.quantity||'0'),0n)
  return{label:unitFromTicks(selected)+' de '+unitFromTicks(total),remaining:unitFromTicks(total>selected?total-selected:0n),complete:selected===total&&selected>0n,exceeded:selected>total}
 }catch{return{label:'Revisa las cantidades',remaining:choice.totalQuantity??'',complete:false,exceeded:false}}
}
export function commercialPackageSeed(quote:{lines?:{package_component_key?:string|null}[];packageGroups?:PackageGroup[];package_groups?:PackageGroup[]}){
 const groups=quote.packageGroups??quote.package_groups??[]
 return{groups,selections:groups.flatMap(g=>g.selection?[structuredClone(g.selection)]:[]),freeItems:(quote.lines??[]).filter(l=>!l.package_component_key),incomplete:groups.some(g=>g.state!=='COMPLETE')}
}
const fingerprint=(v:PackageSelection[])=>JSON.stringify(packageSelectionsPayload(v))
export function useCommercialPackagePreview(scope:PackageScope|null,value:PackageSelection[],stored:PackageGroup[]=[],source?:{quoteId:string;expectedRevision:string}){
 let selectionKey='invalid';try{selectionKey=fingerprint(value)}catch{/* Local decimal errors keep save/send disabled. */}
 const key=JSON.stringify([scope,selectionKey,source?.quoteId,source?.expectedRevision]),current=useRef(key);current.current=key
 const [response,setResponse]=useState<{key:string;groups:PackageGroup[];pending:boolean;error:string}|null>(null)
 const selectedStored=value.map(s=>stored.find(g=>g.groupId===s.groupId)).filter(Boolean) as PackageGroup[]
 let unchanged=false
 try{unchanged=selectedStored.length===value.length&&selectedStored.every((group,i)=>!!group.selection&&fingerprint([group.selection])===fingerprint([value[i]]))}catch{/* Require a server preview. */}
 useEffect(()=>{
  const abort=new AbortController()
  if(!value.length||unchanged)return()=>abort.abort()
  if(!scope||selectionKey==='invalid'){setResponse({key,groups:[],pending:false,error:'Revisa la empresa, sucursal y cantidades del paquete'});return()=>abort.abort()}
  setResponse({key,groups:[],pending:true,error:''})
  const timer=setTimeout(()=>void previewPackages(scope,packageSelectionsPayload(value),abort.signal,source).then(result=>{
   if(!abort.signal.aborted&&current.current===key)setResponse({key,groups:result.packageGroups,pending:false,error:''})
  }).catch(e=>{if(!abort.signal.aborted&&current.current===key)setResponse({key,groups:[],pending:false,error:e.message||'No se pudo revisar el paquete'})}),200)
  return()=>{clearTimeout(timer);abort.abort()}
 },[key,unchanged])
 if(!value.length)return{groups:[],pending:false,error:'',incomplete:false}
 if(unchanged)return{groups:selectedStored,pending:false,error:'',incomplete:selectedStored.some(g=>g.state!=='COMPLETE')}
 const valid=response?.key===key
 return{groups:valid?response.groups:[],pending:valid?response.pending:true,error:valid?response.error:'',incomplete:valid?response.groups.some(g=>g.state!=='COMPLETE'):true}
}

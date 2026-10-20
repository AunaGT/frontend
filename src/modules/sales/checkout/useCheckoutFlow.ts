import {useEffect,useMemo,useRef,useState} from 'react'
import {createSale,fetchCheckoutAttempt} from '@/services/saleService'
import {convertOrderToSale,type ConvertOrderToSalePayload} from '@/services/orderService'
import {getActiveCompanyId,getActiveBranchId,getAuthToken} from '@/services/api'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import {createCheckoutFlow,type CheckoutState} from './checkoutFlow'
import type {CheckoutAttempt,CheckoutScope} from './attemptStorage'
import {withCheckoutLock} from './browserLock'

export function useCheckoutFlow(scope:CheckoutScope,allowed:boolean,onConfirmed:(attempt:CheckoutAttempt,ownsCart:boolean)=>void,permissionContext='',draftId?:string){
  const [state,setState]=useState<CheckoutState>({attempt:null,pending:false,error:null})
  const callback=useRef(onConfirmed);callback.current=onConfirmed
  const draft=useRef(draftId);draft.current=draftId
  const token=getAuthToken(),session=authSessionIdentity(),identity=JSON.stringify([scope.companyId,scope.branchId,scope.userId,allowed,permissionContext,token,session])
  const current=useRef<object|null>(null)
  const owner=useMemo(()=>({identity,active:true}),[identity])
  current.current=owner
  const cartOwnerId=useMemo(()=>{
    try{const key=`auna:checkout:tab:${scope.userId}`,saved=sessionStorage.getItem(key);if(saved)return saved;const id=crypto.randomUUID();sessionStorage.setItem(key,id);return id}catch{return crypto.randomUUID()}
  },[scope.userId])
  const isCurrent=()=>current.current===owner&&owner.active&&allowed&&!!scope.companyId&&!!scope.branchId&&scope.branchId!=='all'&&!!scope.userId&&getActiveCompanyId()===scope.companyId&&getActiveBranchId()===scope.branchId&&getAuthToken()===token&&authSessionIdentity()===session&&authSessionMatches(scope.userId)
  const flow=useMemo(()=>{
    const options={headers:{'X-Company-Id':scope.companyId,'X-Branch-Id':scope.branchId}}
    return createCheckoutFlow({scope,cartOwnerId,getDraftId:()=>draft.current,storage:localStorage,isCurrent,newKey:()=>crypto.randomUUID(),withLock:run=>withCheckoutLock(scope,run),
      submit:async(kind,payload,orderId)=>kind==='SALE'?createSale(payload as unknown as Parameters<typeof createSale>[0],options):{id:((await convertOrderToSale(orderId!,payload as ConvertOrderToSalePayload,options)).sale as {id?:string})?.id},
      lookup:key=>fetchCheckoutAttempt(key,options),onState:setState,onConfirmed:a=>callback.current(a,a.cartOwnerId===cartOwnerId)})
  // The owner is replaced on any scope, session or permission change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[owner,cartOwnerId])
  useEffect(()=>{
    owner.active=true;setState(flow.getState())
    if(flow.getState().attempt)void flow.reconcile()
    const sync=()=>{if(authSessionIdentity()!==session){owner.active=false;setState(s=>({...s,error:'La sesión cambió en otra pestaña. Recarga Auna antes de continuar.'}));return}flow.sync()}
    window.addEventListener('storage',sync)
    return()=>{owner.active=false;window.removeEventListener('storage',sync)}
  },[flow,owner])
  const blocked=!authSessionMatches(scope.userId)
  return {...state,blocked,error:blocked?'La sesión cambió en otra pestaña. Recarga Auna antes de continuar.':state.error,submit:flow.submit,reconcile:flow.reconcile,isCurrent}
}

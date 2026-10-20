import {useEffect,useMemo,useRef,useState} from 'react'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import {getActiveCompanyId,getActiveBranchId} from '@/services/api'
import type {HardwareScope} from '../types'
import {createDrawerSimulation,type DrawerSource} from './flow'
import {findDrawerIntents,claimDrawerIntent,completeDrawerSimulation} from './api'
export function useDrawerSimulation(scope:HardwareScope,allowed:boolean,sourceKey=''){
 const session=authSessionIdentity(),key=JSON.stringify([scope,allowed,session,sourceKey]),live=useRef(key);live.current=key
 const [state,setState]=useState<{key:string;pending:boolean;message:string;outcome:string}|null>(null)
 const flow=useMemo(()=>{
  const abort=new AbortController(),current=()=>live.current===key&&allowed&&!abort.signal.aborted&&authSessionIdentity()===session&&authSessionMatches(scope.userId||'')&&getActiveCompanyId()===scope.companyId&&getActiveBranchId()===scope.branchId
  const run=createDrawerSimulation({current,find:source=>findDrawerIntents(scope,source,abort.signal),claim:(id,station)=>claimDrawerIntent(scope,id,station,abort.signal),result:(id,attempt)=>completeDrawerSimulation(scope,id,attempt,abort.signal),update:value=>setState({key,...value})})
  return{...run,dispose:()=>abort.abort()}
  // Ownership and permission changes invalidate every outstanding continuation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key])
 useEffect(()=>()=>flow.dispose(),[flow])
 const value=state?.key===key?state:{pending:false,message:'',outcome:''}
 return{...value,simulateForSource:(source:DrawerSource,workstationId?:string)=>flow.simulateForSource(source,workstationId)}
}

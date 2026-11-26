import { CASH_DISPUTE_PERMISSIONS } from '@/config/cashClosurePermissions'
import {useEffect,useMemo} from 'react'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
export function useDisputeIdentity(allowConsolidated=false){
  const {company,branch,isConsolidated}=useTenant(),{user,hasPermission}=useAuthPermissions()
  const scope={companyId:company?.id||'',branchId:isConsolidated?'all':branch?.id||'',actorId:user?.id||''}
  const permissions=[...CASH_DISPUTE_PERMISSIONS,'accounting.view','accounting.create'].filter(p=>hasPermission(p)).join(',')
  const key=JSON.stringify([scope.companyId,scope.branchId,scope.actorId,permissions]),controllers=useMemo(()=>new Set<AbortController>(),[key])
  useEffect(()=>()=>{controllers.forEach(c=>c.abort());controllers.clear()},[controllers])
  const newSignal=()=>{const c=new AbortController();controllers.add(c);return c.signal}
  return {scope,key,permissions,newSignal,ready:!!scope.companyId&&!!scope.branchId&&!!scope.actorId&&(scope.branchId!=='all'||allowConsolidated)&&hasPermission(...CASH_DISPUTE_PERMISSIONS)}
}

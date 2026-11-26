import {useEffect,useMemo} from 'react'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
export function useCorrectionIdentity(allowConsolidated=false){
  const {company,branch,isConsolidated}=useTenant(),{user,hasPermission}=useAuthPermissions()
  const scope={companyId:company?.id||'',branchId:isConsolidated?'all':branch?.id||'',actorId:user?.id||''}
  const permissions=['cashclosure.correct','cashclosure.view','cashclosure.view_team','cashclosure.approve','cashclosure.validate'].filter(p=>hasPermission(p)).join(',')
  const key=[scope.companyId,scope.branchId,scope.actorId,permissions].join(':')
  const controllers=useMemo(()=>new Set<AbortController>(),[key])
  useEffect(()=>()=>{controllers.forEach(c=>c.abort());controllers.clear()},[controllers])
  const newSignal=()=>{const c=new AbortController();controllers.add(c);return c.signal}
  return {scope,permissions,key,newSignal,ready:!!scope.companyId&&!!scope.branchId&&(scope.branchId!=='all'||allowConsolidated)&&!!scope.actorId&&!!permissions}
}

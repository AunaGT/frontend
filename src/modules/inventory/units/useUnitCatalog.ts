import {useQuery} from '@tanstack/react-query'
import {useTenant} from '@/context/useTenant'
import {fetchUnits} from './api'
export function useUnitCatalog(enabled:boolean){
  const {company,branch,isConsolidated}=useTenant()
  const scope={companyId:company?.id??'',branchId:branch?.id??(isConsolidated?'all':'')}
  const query=useQuery({queryKey:['inventory-units',scope.companyId,scope.branchId],queryFn:({signal})=>fetchUnits(scope,signal),enabled:enabled&&!!scope.companyId&&!!scope.branchId,staleTime:30000})
  return {...query,units:query.data?.items??[],scope,canWrite:!!scope.companyId&&!!branch?.id&&!isConsolidated}
}

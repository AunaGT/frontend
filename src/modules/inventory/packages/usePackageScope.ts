import {useMemo} from 'react'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import type {PackageScope} from './types'
export function usePackageScope(){
 const tenant=useTenant(),auth=useAuthPermissions(),companyId=tenant.company?.id,branchId=tenant.branch?.id,userId=auth.user?.id,sessionId=authSessionIdentity()
 const valid=!!companyId&&!!branchId&&!!userId&&auth.permissionsReady&&authSessionMatches(userId)&&!tenant.isConsolidated
 const scope=useMemo<PackageScope|null>(()=>valid?{companyId:companyId!,branchId:branchId!,userId:userId!,sessionId}:null,[valid,companyId,branchId,userId,sessionId])
 return{scope,key:JSON.stringify(scope),canRead:auth.hasPermission('products.view'),canEdit:auth.hasPermission('products.edit'),canPublish:auth.hasPermission('products.packages.publish'),canArchive:auth.hasPermission('products.packages.archive'),branches:tenant.branches,registerTenantExitGuard:tenant.registerTenantExitGuard}
}

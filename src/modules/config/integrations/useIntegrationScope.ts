import {useMemo} from 'react'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import type {IntegrationScope} from './types'
export const INTEGRATIONS_READ_PERMISSIONS=['integrations.view','integrations.manage']
export function useIntegrationScope(){
 const tenant=useTenant(),auth=useAuthPermissions()
 const companyId=tenant.company?.id,userId=auth.user?.id,sessionId=authSessionIdentity(),branchId=tenant.branch?.id||(tenant.isConsolidated?'all':undefined),valid=!!userId&&auth.permissionsReady&&authSessionMatches(userId)
 const scope=useMemo<IntegrationScope|null>(()=>companyId&&userId&&valid?{companyId,userId,sessionId,branchId}:null,[companyId,userId,valid,sessionId,branchId])
 const canRead=auth.hasPermission(...INTEGRATIONS_READ_PERMISSIONS),canManage=auth.hasPermission('integrations.manage')
 return{scope,canRead,canManage,readOnly:tenant.isConsolidated,companyName:tenant.company?.name||'Empresa activa',key:JSON.stringify([scope,canRead,canManage])}
}
export type IntegrationContext=ReturnType<typeof useIntegrationScope>

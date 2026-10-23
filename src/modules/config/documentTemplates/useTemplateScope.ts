import {useEffect,useState} from 'react'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import type {TemplateScope} from './types'
export function useTemplateScope(){
  const tenant=useTenant(),auth=useAuthPermissions(),[,refresh]=useState(0)
  useEffect(()=>{const changed=()=>refresh(n=>n+1);window.addEventListener('storage',changed);window.addEventListener('auth:unauthorized',changed);return()=>{window.removeEventListener('storage',changed);window.removeEventListener('auth:unauthorized',changed)}},[])
  const scope:TemplateScope|null=tenant.company?.id&&auth.user?.id&&auth.permissionsReady&&authSessionMatches(auth.user.id)?{companyId:tenant.company.id,branchId:tenant.branch?.id||(tenant.isConsolidated?'all':undefined),userId:auth.user.id,sessionId:authSessionIdentity()}:null
  const canRead=auth.hasPermission('document_templates.view','document_templates.manage','document_templates.publish'),canManage=auth.hasPermission('document_templates.manage'),canPublish=auth.hasPermission('document_templates.publish')
  return {scope,canRead,canManage,canPublish,companyName:tenant.company?.name||'Empresa activa',registerGuard:tenant.registerTenantExitGuard,key:JSON.stringify([scope,canRead,canManage,canPublish])}
}

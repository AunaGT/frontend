import {useAuth} from '@/context/useAuth'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {ModuleTabBar} from '@/components/shared/ModuleTabs'
import {CASH_CLOSURE_READ_PERMISSIONS,CASH_CLOSURE_CREATE_PERMISSIONS,CASH_DAY_READ_PERMISSIONS,CASH_CLOSURE_WORKSPACE_PERMISSIONS} from '@/config/cashClosurePermissions'
import {Navigate,useSearchParams} from 'react-router-dom'
import CashClosureHistory from './CashClosureHistory'
import CashDailyPage from './CashDailyPage'
import {CashClosureTabs} from './components/CashClosureTabs'
import {Notice} from './components/CashPageParts'
import {cashWorkspaceView,cashWorkspaceFallback} from './cashWorkspace'

export default function CashClosureManagement(){
  const {user}=useAuth(),{company,branch,isConsolidated}=useTenant(),{hasPermission}=useAuthPermissions()
  const permissions=CASH_CLOSURE_WORKSPACE_PERMISSIONS.filter(code=>hasPermission(code)).join(',')
  return <Workspace key={JSON.stringify([company?.id,branch?.id,isConsolidated,user?.id,permissions])}/>
}
function Workspace(){
  const {isConsolidated}=useTenant(),{hasPermission}=useAuthPermissions(),[params,setParams]=useSearchParams()
  const day=hasPermission(...CASH_DAY_READ_PERMISSIONS),history=hasPermission(...CASH_CLOSURE_READ_PERMISSIONS,...CASH_CLOSURE_CREATE_PERMISSIONS)
  const view=cashWorkspaceView({day,history,consolidated:!!isConsolidated,requested:params.get('vista')})
  usePageTrail([{label:'Cierre de caja'}])
  if(!view){const destination=cashWorkspaceFallback(hasPermission);return destination?<Navigate replace to={destination}/>:<Notice>No tienes acceso al cierre de caja.</Notice>}
  const tabs=[...(day?[{value:'dia' as const,label:'Día operativo'}]:[]),...(history?[{value:'historial' as const,label:'Historial'}]:[])]
  return <div className="auna-page-fluid mx-auto w-full min-w-0 space-y-4 p-4 sm:p-6">
    <CashClosureTabs value="closures"/>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Cierre de caja</h1><p className="mt-1 text-sm text-muted-foreground">{view==='dia'?'Revisa los turnos, resuelve pendientes y finaliza el día.':'Consulta los conteos registrados y su revisión.'}</p></div>
    {tabs.length>1&&<ModuleTabBar ariaLabel="Vista del cierre de caja" value={view} items={tabs} onValueChange={value=>{const next=new URLSearchParams(params);next.set('vista',value);setParams(next)}}/>}</div>
    {view==='dia'?(isConsolidated?<Notice>Selecciona una sucursal para revisar sus turnos y finalizar el día operativo.</Notice>:<CashDailyPage/>):<CashClosureHistory/>}
  </div>
}

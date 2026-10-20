import {Button} from '@/components/ui/button'
import {useTenant} from '@/context/useTenant'
import {useAuthPermissions} from '@/hooks/useAuthPermissions'
import {useDrawerSimulation} from './useDrawerSimulation'
import type {DrawerSource} from './flow'
export function DrawerSimulationAction({source,workstationId}:{source:DrawerSource;workstationId?:string}){
 const {company,branch,isConsolidated}=useTenant(),{user,hasPermission,permissionsReady}=useAuthPermissions()
 const allowed=permissionsReady&&hasPermission('hardware.test_drawer')&&!isConsolidated
 const simulation=useDrawerSimulation({companyId:company?.id||'',branchId:branch?.id||'',userId:user?.id||''},allowed,JSON.stringify(source))
 if(!allowed)return null
 return <div className="flex flex-wrap items-center gap-2 text-xs"><Button size="sm" variant="outline" disabled={simulation.pending||['SIMULATED','UNKNOWN'].includes(simulation.outcome)} onClick={()=>void simulation.simulateForSource(source,workstationId)}>{simulation.pending?'Revisando…':'Simular apertura'}</Button><span role="status" className="text-muted-foreground">{simulation.message||'Solo simulación, después de efectivo registrado.'}</span></div>
}

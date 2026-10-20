import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/shared/Pagination'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { getHardwareHistory } from './api'
import type { AuditEvent, HardwarePage, HardwareScope, TestRun } from './types'
const actions: Record<string,string> = { WORKSTATION_CREATED:'Puesto creado', WORKSTATION_UPDATED:'Puesto actualizado', DEVICE_CREATED:'Equipo registrado', DEVICE_UPDATED:'Equipo actualizado', ASSIGNMENTS_UPDATED:'Asignaciones actualizadas', SCAN_INPUT:'Entrada de código', TICKET_SAMPLE:'Ticket de prueba', LABEL_SAMPLE:'Etiqueta de prueba', OFFICE_SAMPLE:'Documento de prueba', DRAWER_SIMULATION:'Simulación de gaveta', SIMULATED:'Simulado', PREPARED:'PDF preparado', INPUT_RECEIVED:'Entrada recibida', ERROR:'Error' }
export function HardwareHistory({ scope, tests=false, refresh=0 }: { scope: HardwareScope; tests?: boolean; refresh?: number }) {
  const [page,setPage]=useState(1),[retry,setRetry]=useState(0),[state,setState]=useState<{key:string;data:HardwarePage<AuditEvent|TestRun>|null;error:string}>({key:'',data:null,error:''})
  const key=JSON.stringify([scope.companyId,scope.branchId,scope.userId,tests,page,refresh,retry])
  useEffect(()=>{const controller=new AbortController();setState({key,data:null,error:''});getHardwareHistory(scope,page,tests,controller.signal).then(data=>{if(!controller.signal.aborted)setState({key,data,error:''})},e=>{if(!controller.signal.aborted)setState({key,data:null,error:e.message||'No se pudo cargar el historial'})});return()=>controller.abort()},[key])
  if(state.key!==key)return <p role="status" className="text-sm text-muted-foreground">Cargando historial…</p>
  if(state.error)return <div role="alert" className="space-y-2"><p>{state.error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Reintentar</Button></div>
  if(!state.data)return <p role="status">Cargando historial…</p>
  return <section className="space-y-3" aria-label={tests?'Historial de pruebas':'Historial de hardware'}>{state.data.items.length?<><ul className="divide-y divide-border">{state.data.items.map(row=><li key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><strong>{'kind'in row?actions[row.kind]:actions[row.action]||'Configuración actualizada'}</strong><p className="text-xs text-muted-foreground">{'outcome'in row?`${actions[row.outcome]} · no verifica hardware físico`:`Registro ${row.entityId.slice(0,8)}`}</p></div><time className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</time></li>)}</ul><div className="hardware-pagination"><Pagination currentPage={state.data.page} totalPages={state.data.totalPages} totalItems={state.data.totalItems} pageSize={10} count={state.data.items.length} itemLabel="eventos" onPageChange={setPage}/></div></>:<CollectionEmptyState compact title="Cada prueba y ajuste dejará su huella" description="Aquí podrás consultar las próximas acciones de esta sucursal."/>}</section>
}

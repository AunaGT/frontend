import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {ConfirmDialog} from '@/components/shared/ConfirmDialog'
import {useAgendaContext} from '../useAgendaContext'
import {appointmentQueryKey,getAgenda} from '../api'
import {emptyDirectory} from '../useServiceScheduleDraft'
import {useActivityDraft,localDateTime,type ActivityDraft} from '../activityDraft'
import {ActivityFields} from './ActivityFields'
import {FormFeedback} from './FormFeedback'
import {useDraftGuard} from './DraftGuard'
import type {ActivityDto,Directory} from '../types'
export function ActivityEditor({initial,row,onSaved,onClose,compact=false,onCloseReady}: {initial?:Partial<ActivityDraft>;row?:ActivityDto;onSaved:(r:ActivityDto)=>void;onClose:()=>void;compact?:boolean;onCloseReady?:(close:()=>void)=>void}) {
  const ctx=useAgendaContext(),navigate=useNavigate()
  const [confirm,setConfirm]=useState(false)
  const draft=useActivityDraft({scope:ctx.scope,userId:ctx.user?.id||'',timezone:ctx.timezone,initial,row,onSaved:r=>guard.proceed(()=>onSaved(r))})
  const guard=useDraftGuard(draft.dirty),allowed=ctx.writable&&ctx.hasPermission(row?'appointments.edit':'appointments.create')
  useEffect(()=>{onCloseReady?.(()=>{if(!draft.pending)guard.request(onClose)})})
  const directory=useQuery({queryKey:appointmentQueryKey(ctx.scope,'directory'),queryFn:({signal})=>getAgenda<Directory>('/directory',ctx.scope,signal),enabled:allowed})
  const more=()=>guard.proceed(()=>navigate('/agenda/actividades/nueva',{state:{activityDraft:draft.handoff()}}))
  if(!allowed)return <p>Selecciona una sucursal con permiso para {row?'editar':'crear'} actividades.</p>
  return <form onSubmit={e=>{e.preventDefault();if(row)setConfirm(true);else void draft.save()}} aria-busy={draft.pending} className="agenda-editor-grid">{guard.dialog}<section className="agenda-panel space-y-4"><h2>{row?'Editar actividad':'Nueva actividad'}</h2><FormFeedback error={draft.error||(directory.isError?'No se pudo cargar el personal y equipo. Puedes reintentar.':null)} fields={draft.fields}/>
    <ActivityFields scope={ctx.scope} value={draft.value} onChange={draft.change} pending={draft.pending} errors={draft.fields} directory={directory.data||emptyDirectory} policy={row?.schedulingPolicy} assigned={row?{providers:row.providers,resources:row.resources}:undefined} organizerName={row?.organizer?.name||ctx.user?.name} capabilities={{catalog:!row?.serviceScheduling&&!!ctx.canUseCatalog,contacts:!!ctx.canUseContacts,notes:ctx.hasPermission('appointments.attend')||ctx.hasPermission('appointments.configure')}}/>
    {row&&<div><Label htmlFor="activity-reason">Motivo del cambio *</Label><Textarea id="activity-reason" required maxLength={500} value={draft.reason} disabled={draft.pending} onChange={e=>draft.setReason(e.target.value)}/></div>}
    <div className="agenda-actions">{compact&&<Button type="button" variant="ghost" disabled={draft.pending} onClick={more}>Abrir formulario completo</Button>}<Button type="button" variant="outline" disabled={draft.pending} onClick={()=>guard.request(onClose)}>Cancelar</Button><Button type="submit" disabled={draft.pending}>{draft.pending?'Guardando…':row?'Guardar cambios':'Guardar actividad'}</Button></div>
  </section><aside className="agenda-panel agenda-editor-summary space-y-4"><h2>Resumen</h2><p className="font-medium">{draft.value.title||'Actividad'}</p><p className="text-sm">{localDateTime(draft.value.startsAt,draft.value.timezone).replace('T',' ')}<br/>{localDateTime(draft.value.endsAt,draft.value.timezone).replace('T',' ')}</p><p className="border-t pt-3 text-xs text-muted-foreground">{draft.value.timezone}. Se conservan el historial y las condiciones del servicio. Los traslados y las asignaciones se revalidan al guardar.</p></aside>
    {row&&<ConfirmDialog open={confirm} onOpenChange={setConfirm} appearance="auna" title="Confirmar cambios de programación" description={`Antes: ${localDateTime(row.startsAt,row.timezone).replace('T',' ')} – ${localDateTime(row.endsAt,row.timezone).replace('T',' ')}. Nuevo: ${localDateTime(draft.value.startsAt,draft.value.timezone).replace('T',' ')} – ${localDateTime(draft.value.endsAt,draft.value.timezone).replace('T',' ')}. Motivo: ${draft.reason}`} confirmText="Guardar cambios" cancelText="Seguir editando" loading={draft.pending} onConfirm={()=>{setConfirm(false);void draft.save()}}/>}
  </form>
}

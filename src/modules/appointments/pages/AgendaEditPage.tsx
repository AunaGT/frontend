import {useState} from 'react'
import {Link,useLocation,useNavigate,useParams} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {Button} from '@/components/ui/button'
import {LoadingState} from '@/components/shared/LoadingState'
import {useAgendaContext} from '../useAgendaContext'
import {appointmentQueryKey,getAgenda} from '../api'
import {creationDestination} from '../creationDraft'
import {activityFromDto} from '../activityDraft'
import {ActivityEditor} from '../components/ActivityQuickCreate'
import {MoveForm} from '../components/MoveDialog'
import {emptyDirectory} from '../useServiceScheduleDraft'
import type {ActivityDto,BookingDetail,SessionDetail,Directory} from '../types'
import '../appointments.css'

type EditKind='ACTIVITY'|'BOOKING'|'SESSION'
type EditRow=ActivityDto|BookingDetail|SessionDetail
export default function AgendaEditPage({kind}:{kind:EditKind}){
  const ctx=useAgendaContext(),{id}=useParams()
  return <EditWorkspace key={`${ctx.scope.companyId}:${ctx.scope.branchId}:${kind}:${id}`} kind={kind} id={id||''}/>
}
function EditWorkspace({kind,id}:{kind:EditKind;id:string}){
  const ctx=useAgendaContext(),location=useLocation(),navigate=useNavigate(),path=kind==='ACTIVITY'?'activities':kind==='SESSION'?'sessions':'bookings'
  usePageTrail([{label:'Agenda',to:'/agenda'},{label:kind==='ACTIVITY'?'Actividad':kind==='SESSION'?'Sesión':'Reserva',to:creationDestination(kind,id)},{label:'Editar'}])
  const allowed=ctx.ready&&ctx.writable&&ctx.hasPermission('appointments.edit')
  const query=useQuery({queryKey:appointmentQueryKey(ctx.scope,'edit-'+path,{id}),queryFn:({signal})=>getAgenda<EditRow>(`/${path}/${id}`,ctx.scope,signal),enabled:allowed&&!!id})
  const directory=useQuery({queryKey:appointmentQueryKey(ctx.scope,'directory'),queryFn:({signal})=>getAgenda<Directory>('/directory',ctx.scope,signal),enabled:allowed})
  const row=allowed?query.data:undefined
  const close=()=>navigate(creationDestination(kind,id),{replace:true,state:null})
  if(!allowed)return <main className="agenda-page"><p role="alert">Selecciona una sucursal con permiso para editar.</p><Link to="/agenda">Volver a Agenda</Link></main>
  if(query.isLoading)return <main className="agenda-page"><LoadingState variant="detail" message="Cargando programación…"/></main>
  if(!row)return <main className="agenda-page"><p role="alert">No se pudo cargar la programación.</p><Button variant="outline" onClick={()=>void query.refetch()}>Reintentar</Button><Button variant="ghost" onClick={close}>Volver al detalle</Button></main>
  if(kind!=='ACTIVITY'&&(!['HELD','PENDING','CONFIRMED','SCHEDULED'].includes(row.status)||new Date(row.startsAt)<=new Date())||kind==='ACTIVITY'&&row.status!=='SCHEDULED')return <main className="agenda-page"><p role="status">Esta programación ya comenzó o su estado no permite editarla.</p><Button onClick={close}>Volver al detalle</Button></main>
  return <main className="agenda-page"><h1 className="sr-only">Editar programación</h1>{directory.isError&&<div role="alert"><p>No se pudieron actualizar las asignaciones. Tus cambios se conservan.</p><Button variant="outline" onClick={()=>void directory.refetch()}>Reintentar asignaciones</Button></div>}<LoadedEditor row={row} kind={kind} directory={directory.data||emptyDirectory} proposed={location.state?.proposed} onClose={close}/></main>
}
function LoadedEditor({row,kind,directory,proposed,onClose}:{row:EditRow;kind:EditKind;directory:Directory;proposed?:{startsAt:string;endsAt?:string};onClose:()=>void}){
  const ctx=useAgendaContext(),[original]=useState(row)
  if(kind!=='ACTIVITY')return <MoveForm scope={ctx.scope} row={original as BookingDetail|SessionDetail} kind={kind==='SESSION'?'sessions':'bookings'} directory={directory} proposed={proposed?.startsAt} onClose={onClose}/>
  const activity=original as ActivityDto,initial=activityFromDto(activity)
  if(proposed&&Number.isFinite(new Date(proposed.startsAt).getTime())){
    initial.startsAt=proposed.startsAt
    initial.endsAt=proposed.endsAt||new Date(new Date(proposed.startsAt).getTime()+new Date(activity.endsAt).getTime()-new Date(activity.startsAt).getTime()).toISOString()
  }
  return <ActivityEditor initial={initial} row={activity} onClose={onClose} onSaved={onClose}/>
}

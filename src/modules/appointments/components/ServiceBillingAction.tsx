import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {useAgendaContext} from '../useAgendaContext'
import type {BillingOrigin} from '../commercialTypes'
export function ServiceBillingAction({origin,engagementId,eligible}:{origin:BillingOrigin;engagementId?:string|null;eligible:boolean}){
  const ctx=useAgendaContext()
  if(engagementId)return ctx.ready?<Button variant="outline" size="sm" asChild><Link to={`/agenda/contrataciones/${engagementId}`}>Ver contratación</Link></Button>:null
  if(!eligible||!ctx.writable||!ctx.canUseCatalog||!ctx.canUseContacts||!['appointments.create','receivables.view'].every(permission=>ctx.hasPermission(permission)))return null
  return <Button variant="outline" size="sm" asChild><Link to={`/agenda/${origin.kind==='BOOKING'?'reservas':'actividades'}/${origin.id}/cobros`}>Gestionar cobros</Link></Button>
}

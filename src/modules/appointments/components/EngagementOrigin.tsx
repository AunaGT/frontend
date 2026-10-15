import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
export function EngagementOrigin({engagementId}:{engagementId?:string|null}){
  if(!engagementId)return null
  return <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3"><p className="text-sm text-muted-foreground">Este servicio forma parte de una contratación completa. Sus pagos y su venta se gestionan en el conjunto, no por esta programación.</p><Button asChild variant="outline" size="sm"><Link to={`/agenda/contrataciones/${engagementId}`}>Ver contratación</Link></Button></div>
}

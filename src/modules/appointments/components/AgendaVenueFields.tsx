import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LocationInput, VenueKind } from '../types'
export const venueLabels: Record<VenueKind,string> = { BRANCH:'En sucursal', HOME:'A domicilio', EVENT_VENUE:'Lugar del evento', ONLINE:'En línea' }
export function AgendaVenueFields({value,onChange,disabled,allowedKinds=Object.keys(venueLabels) as VenueKind[],idPrefix='agenda'}: {
  value:LocationInput;onChange:(next:LocationInput)=>void;disabled?:boolean;allowedKinds?:VenueKind[];idPrefix?:string;
}) {
  const venue=value.venue||{kind:'BRANCH'}
  const field=(key:'name'|'address'|'references'|'url',label:string,maxLength:number,type='text')=><div><Label htmlFor={`${idPrefix}-venue-${key}`}>{label}</Label><Input id={`${idPrefix}-venue-${key}`} type={type} maxLength={maxLength} value={venue[key]||''} onChange={e=>onChange({...value,venue:{...venue,[key]:e.target.value}})} disabled={disabled}/></div>
  return <div className="space-y-3"><div><Label id={`${idPrefix}-venue-label`}>Lugar de atención</Label><Select value={venue.kind} onValueChange={kind=>onChange({...value,venue:{...venue,kind:kind as VenueKind}})} disabled={disabled}><SelectTrigger aria-labelledby={`${idPrefix}-venue-label`}><SelectValue/></SelectTrigger><SelectContent>{allowedKinds.map(k=><SelectItem key={k} value={k}>{venueLabels[k]}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">La sucursal seleccionada organiza la actividad, aunque se realice en otro lugar.</p></div>
    {venue.kind!=='BRANCH'&&<div className="grid gap-3 sm:grid-cols-2">{field('name','Nombre del lugar (opcional)',200)}{['HOME','EVENT_VENUE'].includes(venue.kind)&&<>{field('address','Dirección *',2000)}{field('references','Referencias de llegada (opcional)',2000)}</>}{venue.kind==='ONLINE'&&field('url','Enlace de reunión · HTTPS (opcional)',2000,'url')}</div>}
    <div className="grid grid-cols-2 gap-3">{([['outboundMinutes','Traslado de ida (min)'],['returnMinutes','Regreso (min)']] as const).map(([key,label])=><div key={key}><Label htmlFor={`${idPrefix}-${key}`}>{label}</Label><Input id={`${idPrefix}-${key}`} type="number" min={0} max={1440} step={5} value={value[key]??0} disabled={disabled} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></div>)}</div>
  </div>
}
